/**
 * Unit tests for Oracle of Wit GenLayer Intelligent Contract logic.
 *
 * The actual contract runs in GenLayer's Python VM with gl.* primitives,
 * so we replicate the core logic in JS to verify correctness without
 * needing a running GenLayer node.
 *
 * ~48 tests covering: judge_round, leaderboard, create_game,
 * record_game_result, appeal, season_reset, player_history,
 * data structure validation, and admin access control.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal in-memory replica of the contract state & logic
//
// Mirrors contracts/oracle_of_wit.py as closely as possible.
// TreeMap[str, str] in the Python contract stores JSON strings; here we
// keep parsed objects in memory but replicate every branch & edge case.
// ---------------------------------------------------------------------------

class OracleOfWitSim {
  constructor() {
    // Access control is at the SDK layer (private key signs writeContract calls).
    // No on-chain admin model needed.
    this.games = {};          // game_id -> game state object
    this.leaderboard = {};    // player_name -> total_score (int)
    this.player_games = {};   // player_name -> [game_id, ...]
    this.seasons = {};        // season_id -> archive object
    this.total_games = 0;
    this.total_judgments = 0;
  }

  // -- View functions -------------------------------------------------------

  get_game(game_id) {
    return this.games[game_id] ?? null;
  }

  get_leaderboard(limit = 20) {
    return Object.entries(this.leaderboard)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  get_stats() {
    return {
      total_games: this.total_games,
      total_judgments: this.total_judgments,
    };
  }

  get_player_history(player_name) {
    const total_score = this.leaderboard[player_name] ?? 0;
    const game_ids = this.player_games[player_name] ?? [];

    const games = [];
    for (const gid of game_ids) {
      const g = this.games[gid];
      if (g) {
        games.push({
          game_id: g.id ?? gid,
          category: g.category ?? 'unknown',
          status: g.status ?? 'unknown',
        });
      }
    }

    return {
      player_name,
      total_score,
      games_played: games.length,
      games,
    };
  }

  get_season(season_id) {
    return this.seasons[season_id] ?? null;
  }

  // -- Write functions ------------------------------------------------------

  create_game(game_id, host_name, category) {
    if (this.games[game_id] != null) {
      throw new Error('Game ID already exists');
    }

    const state = {
      id: game_id,
      host: host_name,
      category,
      status: 'created',
      rounds_judged: 0,
    };
    this.games[game_id] = state;
    this.total_games += 1;

    // Track host in player_games index (matches Python contract)
    const hostGames = this.player_games[host_name] ?? [];
    if (!hostGames.includes(game_id)) {
      hostGames.push(game_id);
      this.player_games[host_name] = hostGames;
    }

    return state;
  }

  /**
   * Judge a round. In the real contract the winner_id comes from
   * gl.eq_principle_prompt_comparative; here we accept it as a parameter.
   */
  judge_round(game_id, submissions, winner_id_from_od) {
    if (submissions.length === 0) throw new Error('No submissions to judge');

    if (submissions.length === 1) {
      return {
        winner_id: submissions[0].id,
        winner_name: submissions[0].playerName,
        winning_punchline: submissions[0].punchline,
        consensus_method: 'single_submission',
      };
    }

    // Find winner; fallback to first if ID invalid
    let winner = submissions.find((s) => s.id === winner_id_from_od);
    if (!winner) winner = submissions[0];

    // Update leaderboard (+100 per round win)
    const current = this.leaderboard[winner.playerName] ?? 0;
    this.leaderboard[winner.playerName] = current + 100;
    this.total_judgments += 1;

    return {
      winner_id: winner.id,
      winner_name: winner.playerName,
      winning_punchline: winner.punchline,
      consensus_method: 'optimistic_democracy',
      validators_agreed: true,
    };
  }

  record_game_result(game_id, final_scores) {
    // Idempotency: skip if already finished
    const game = this.games[game_id];
    if (game && game.status === 'finished') {
      return { recorded: false, reason: 'already_finished' };
    }

    for (const p of final_scores) {
      const current = this.leaderboard[p.playerName] ?? 0;
      this.leaderboard[p.playerName] = current + p.score;

      // Track in player_games index
      const pg = this.player_games[p.playerName] ?? [];
      if (!pg.includes(game_id)) {
        pg.push(game_id);
        this.player_games[p.playerName] = pg;
      }
    }

    if (game) game.status = 'finished';
    return { recorded: true, players_updated: final_scores.length };
  }

  appeal_judgment(game_id, submissions, original_winner_id, new_winner_id_from_od) {
    if (submissions.length <= 1) {
      return {
        new_winner_id: submissions[0]?.id ?? original_winner_id,
        overturned: false,
        consensus_method: 'single_submission',
      };
    }

    const overturned = new_winner_id_from_od !== original_winner_id;
    if (overturned) {
      const oldWinner = submissions.find((s) => s.id === original_winner_id);
      const newWinner = submissions.find((s) => s.id === new_winner_id_from_od);
      if (oldWinner) {
        this.leaderboard[oldWinner.playerName] = Math.max(
          0,
          (this.leaderboard[oldWinner.playerName] ?? 0) - 100,
        );
      }
      if (newWinner) {
        this.leaderboard[newWinner.playerName] =
          (this.leaderboard[newWinner.playerName] ?? 0) + 100;
      }
    }
    this.total_judgments += 1;

    const newWinnerSub = submissions.find((s) => s.id === new_winner_id_from_od);
    return {
      new_winner_id: new_winner_id_from_od,
      new_winner_name: newWinnerSub?.playerName ?? 'Unknown',
      new_winning_punchline: newWinnerSub?.punchline ?? '',
      overturned,
      consensus_method: 'optimistic_democracy_appeal',
    };
  }

  season_reset(season_id) {
    if (this.seasons[season_id] != null) {
      throw new Error('Season ID already archived');
    }

    // Snapshot current leaderboard sorted descending
    const snapshot = Object.entries(this.leaderboard)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);

    const archive = {
      season_id,
      leaderboard: snapshot,
      total_games: this.total_games,
      total_judgments: this.total_judgments,
    };
    this.seasons[season_id] = archive;

    // Reset every player's score to 0 (Python contract sets to 0, not delete)
    for (const entry of snapshot) {
      this.leaderboard[entry.name] = 0;
    }

    return archive;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OracleOfWit Contract', () => {
  let contract;

  beforeEach(() => {
    contract = new OracleOfWitSim();
  });

  // =========================================================================
  // Initialization
  // =========================================================================

  it('initializes with zero state', () => {
    const stats = contract.get_stats();
    expect(stats.total_games).toBe(0);
    expect(stats.total_judgments).toBe(0);
    expect(contract.get_leaderboard()).toEqual([]);
  });

  // =========================================================================
  // judge_round (~8 tests)
  // =========================================================================

  describe('judge_round', () => {
    const submissions = [
      { id: 1, playerName: 'Alice', punchline: 'Because light attracts bugs.' },
      { id: 2, playerName: 'Bob', punchline: 'They already live in the dark.' },
      { id: 3, playerName: 'Charlie', punchline: 'Their future is dark enough.' },
    ];

    it('throws on empty submissions', () => {
      expect(() => contract.judge_round('G1', [], 1)).toThrow('No submissions');
    });

    it('auto-wins with single submission', () => {
      const result = contract.judge_round('G1', [submissions[0]], 1);
      expect(result.winner_id).toBe(1);
      expect(result.winner_name).toBe('Alice');
      expect(result.consensus_method).toBe('single_submission');
    });

    it('does not update leaderboard for single submission', () => {
      contract.judge_round('G1', [submissions[0]], 1);
      // single_submission path returns early without touching the leaderboard
      expect(contract.get_leaderboard()).toEqual([]);
    });

    it('selects the OD-chosen winner', () => {
      const result = contract.judge_round('G1', submissions, 2);
      expect(result.winner_id).toBe(2);
      expect(result.winner_name).toBe('Bob');
      expect(result.winning_punchline).toBe('They already live in the dark.');
    });

    it('returns optimistic_democracy consensus method for multiple submissions', () => {
      const result = contract.judge_round('G1', submissions, 1);
      expect(result.consensus_method).toBe('optimistic_democracy');
      expect(result.validators_agreed).toBe(true);
    });

    it('awards 100 points to the winner', () => {
      contract.judge_round('G1', submissions, 2);
      const lb = contract.get_leaderboard();
      expect(lb[0]).toEqual({ name: 'Bob', score: 100 });
    });

    it('falls back to first submission for invalid winner ID', () => {
      const result = contract.judge_round('G1', submissions, 999);
      expect(result.winner_id).toBe(1);
      expect(result.winner_name).toBe('Alice');
    });

    it('increments total_judgments each round', () => {
      contract.judge_round('G1', submissions, 1);
      contract.judge_round('G2', submissions, 2);
      expect(contract.get_stats().total_judgments).toBe(2);
    });

    it('accumulates leaderboard points across rounds', () => {
      contract.judge_round('G1', submissions, 1); // Alice +100
      contract.judge_round('G2', submissions, 1); // Alice +100
      const lb = contract.get_leaderboard();
      const alice = lb.find((e) => e.name === 'Alice');
      expect(alice.score).toBe(200);
    });
  });

  // =========================================================================
  // Leaderboard (~5 tests)
  // =========================================================================

  describe('get_leaderboard', () => {
    it('returns empty array when no scores recorded', () => {
      expect(contract.get_leaderboard()).toEqual([]);
    });

    it('new player starts at 0 (not on board until points earned)', () => {
      const lb = contract.get_leaderboard();
      const unknown = lb.find((e) => e.name === 'Ghost');
      expect(unknown).toBeUndefined();
    });

    it('accumulates points correctly', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      contract.record_game_result('G2', [{ playerName: 'Alice', score: 250 }]);
      const lb = contract.get_leaderboard();
      expect(lb[0]).toEqual({ name: 'Alice', score: 350 });
    });

    it('sorts by score descending', () => {
      contract.record_game_result('G1', [
        { playerName: 'Low', score: 10 },
        { playerName: 'High', score: 999 },
        { playerName: 'Mid', score: 500 },
      ]);
      const lb = contract.get_leaderboard();
      expect(lb[0].name).toBe('High');
      expect(lb[1].name).toBe('Mid');
      expect(lb[2].name).toBe('Low');
    });

    it('respects the limit parameter', () => {
      for (let i = 0; i < 25; i++) {
        contract.record_game_result(`G${i}`, [{ playerName: `Player${i}`, score: (i + 1) * 10 }]);
      }
      expect(contract.get_leaderboard(5).length).toBe(5);
      expect(contract.get_leaderboard(20).length).toBe(20);
      expect(contract.get_leaderboard().length).toBe(20); // default limit
    });
  });

  // =========================================================================
  // create_game (~4 tests)
  // =========================================================================

  describe('create_game', () => {
    it('creates a game and increments total_games', () => {
      const game = contract.create_game('GAME_A1', 'Alice', 'tech');
      expect(game.id).toBe('GAME_A1');
      expect(game.host).toBe('Alice');
      expect(game.category).toBe('tech');
      expect(contract.get_stats().total_games).toBe(1);
    });

    it('rejects duplicate game IDs', () => {
      contract.create_game('GAME_A1', 'Alice', 'tech');
      expect(() => contract.create_game('GAME_A1', 'Bob', 'crypto')).toThrow(
        'Game ID already exists',
      );
    });

    it('stores game retrievable via get_game', () => {
      contract.create_game('GAME_X', 'Host', 'general');
      const fetched = contract.get_game('GAME_X');
      expect(fetched).not.toBeNull();
      expect(fetched.host).toBe('Host');
      expect(fetched.category).toBe('general');
    });

    it('initializes with status "created" and rounds_judged 0', () => {
      const game = contract.create_game('G1', 'Alice', 'puns');
      expect(game.status).toBe('created');
      expect(game.rounds_judged).toBe(0);
    });

    it('tracks host in player_games index', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.create_game('G2', 'Alice', 'puns');
      const history = contract.get_player_history('Alice');
      expect(history.games_played).toBe(2);
    });
  });

  // =========================================================================
  // record_game_result (~5 tests)
  // =========================================================================

  describe('record_game_result', () => {
    it('updates leaderboard with final scores', () => {
      contract.create_game('G1', 'Alice', 'tech');
      const result = contract.record_game_result('G1', [
        { playerName: 'Alice', score: 300 },
        { playerName: 'Bob', score: 150 },
      ]);
      expect(result.recorded).toBe(true);
      expect(result.players_updated).toBe(2);
      const lb = contract.get_leaderboard();
      expect(lb[0]).toEqual({ name: 'Alice', score: 300 });
      expect(lb[1]).toEqual({ name: 'Bob', score: 150 });
    });

    it('marks game as finished', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(contract.get_game('G1').status).toBe('finished');
    });

    it('is idempotent - second call on finished game returns already_finished', () => {
      contract.create_game('G1', 'Alice', 'tech');
      const first = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(first.recorded).toBe(true);

      const second = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(second.recorded).toBe(false);
      expect(second.reason).toBe('already_finished');

      // Score should not double-count
      expect(contract.get_leaderboard()[0].score).toBe(100);
    });

    it('accumulates scores across multiple games', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      contract.record_game_result('G2', [{ playerName: 'Alice', score: 200 }]);
      expect(contract.get_leaderboard()[0].score).toBe(300);
    });

    it('tracks players in player_games index', () => {
      contract.create_game('G1', 'Host', 'tech');
      contract.record_game_result('G1', [
        { playerName: 'Alice', score: 50 },
        { playerName: 'Bob', score: 75 },
      ]);
      const aliceHistory = contract.get_player_history('Alice');
      expect(aliceHistory.games_played).toBe(1);
      expect(aliceHistory.games[0].game_id).toBe('G1');
    });
  });

  // =========================================================================
  // appeal_judgment (~5 tests)
  // =========================================================================

  describe('appeal_judgment', () => {
    const submissions = [
      { id: 1, playerName: 'Alice', punchline: 'Joke A' },
      { id: 2, playerName: 'Bob', punchline: 'Joke B' },
      { id: 3, playerName: 'Charlie', punchline: 'Joke C' },
    ];

    it('returns overturned=false when same winner confirmed', () => {
      const result = contract.appeal_judgment('G1', submissions, 1, 1);
      expect(result.overturned).toBe(false);
      expect(result.new_winner_id).toBe(1);
      expect(result.new_winner_name).toBe('Alice');
    });

    it('overturns judgment when different winner selected', () => {
      const result = contract.appeal_judgment('G1', submissions, 1, 2);
      expect(result.overturned).toBe(true);
      expect(result.new_winner_id).toBe(2);
      expect(result.new_winner_name).toBe('Bob');
    });

    it('deducts 100 points from old winner on overturn', () => {
      // Give Alice 200 points first
      contract.judge_round('G1', submissions, 1);
      contract.judge_round('G2', submissions, 1);
      expect(contract.get_leaderboard()[0].score).toBe(200);

      // Appeal overturns to Bob
      contract.appeal_judgment('G1', submissions, 1, 2);
      const alice = contract.get_leaderboard().find((e) => e.name === 'Alice');
      expect(alice.score).toBe(100); // 200 - 100
    });

    it('awards 100 points to new winner on overturn', () => {
      contract.appeal_judgment('G1', submissions, 1, 2);
      const bob = contract.get_leaderboard().find((e) => e.name === 'Bob');
      expect(bob.score).toBe(100);
    });

    it('leaderboard cannot go below 0 on overturn', () => {
      // Alice has 0 points, overturn should clamp at 0
      contract.appeal_judgment('G1', submissions, 1, 2);
      const alice = contract.get_leaderboard().find((e) => e.name === 'Alice');
      expect(alice.score).toBe(0);
    });

    it('handles single submission appeal gracefully', () => {
      const result = contract.appeal_judgment('G1', [submissions[0]], 1, 1);
      expect(result.overturned).toBe(false);
      expect(result.consensus_method).toBe('single_submission');
    });

    it('uses optimistic_democracy_appeal consensus method for multi-submission', () => {
      const result = contract.appeal_judgment('G1', submissions, 1, 2);
      expect(result.consensus_method).toBe('optimistic_democracy_appeal');
    });
  });

  // =========================================================================
  // season_reset (~4 tests)
  // =========================================================================

  describe('season_reset', () => {
    it('archives the current leaderboard snapshot', () => {
      contract.record_game_result('G1', [
        { playerName: 'Alice', score: 500 },
        { playerName: 'Bob', score: 300 },
      ]);
      const archive = contract.season_reset('S1');
      expect(archive.season_id).toBe('S1');
      expect(archive.leaderboard.length).toBe(2);
      expect(archive.leaderboard[0].name).toBe('Alice');
      expect(archive.leaderboard[0].score).toBe(500);
    });

    it('resets all player scores to 0', () => {
      contract.record_game_result('G1', [
        { playerName: 'Alice', score: 500 },
        { playerName: 'Bob', score: 300 },
      ]);
      contract.season_reset('S1');

      const lb = contract.get_leaderboard();
      // Scores are 0 — players still exist but with zero
      for (const entry of lb) {
        expect(entry.score).toBe(0);
      }
    });

    it('throws on duplicate season ID', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      contract.season_reset('S1');
      expect(() => contract.season_reset('S1')).toThrow('Season ID already archived');
    });

    it('snapshot is sorted by score descending', () => {
      contract.record_game_result('G1', [
        { playerName: 'Low', score: 10 },
        { playerName: 'High', score: 999 },
        { playerName: 'Mid', score: 500 },
      ]);
      const archive = contract.season_reset('S1');
      expect(archive.leaderboard[0].name).toBe('High');
      expect(archive.leaderboard[1].name).toBe('Mid');
      expect(archive.leaderboard[2].name).toBe('Low');
    });

    it('archived season is retrievable via get_season', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      contract.season_reset('S1');
      const season = contract.get_season('S1');
      expect(season).not.toBeNull();
      expect(season.season_id).toBe('S1');
      expect(season.leaderboard.length).toBe(1);
    });

    it('includes total_games and total_judgments in archive', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.judge_round('G1', [
        { id: 1, playerName: 'Alice', punchline: 'A' },
        { id: 2, playerName: 'Bob', punchline: 'B' },
      ], 1);
      const archive = contract.season_reset('S1');
      expect(archive.total_games).toBe(1);
      expect(archive.total_judgments).toBe(1);
    });
  });

  // =========================================================================
  // get_player_history (~4 tests)
  // =========================================================================

  describe('get_player_history', () => {
    it('returns defaults for unknown player', () => {
      const history = contract.get_player_history('Nobody');
      expect(history.player_name).toBe('Nobody');
      expect(history.total_score).toBe(0);
      expect(history.games_played).toBe(0);
      expect(history.games).toEqual([]);
    });

    it('returns correct total score', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 200 }]);
      contract.record_game_result('G2', [{ playerName: 'Alice', score: 150 }]);
      const history = contract.get_player_history('Alice');
      expect(history.total_score).toBe(350);
    });

    it('returns correct game count', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.create_game('G2', 'Alice', 'puns');
      contract.create_game('G3', 'Bob', 'dark');
      const history = contract.get_player_history('Alice');
      expect(history.games_played).toBe(2);
    });

    it('populates game details (id, category, status)', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      const history = contract.get_player_history('Alice');
      expect(history.games.length).toBeGreaterThan(0);
      const game = history.games.find((g) => g.game_id === 'G1');
      expect(game).toBeDefined();
      expect(game.category).toBe('tech');
      expect(game.status).toBe('finished');
    });
  });

  // =========================================================================
  // Data Structure Validation (~5 tests)
  // =========================================================================

  describe('Data structure validation', () => {
    const submissions = [
      { id: 1, playerName: 'Alice', punchline: 'Joke A' },
      { id: 2, playerName: 'Bob', punchline: 'Joke B' },
    ];

    it('judge_round output has all required fields (single submission)', () => {
      const result = contract.judge_round('G1', [submissions[0]], 1);
      expect(result).toHaveProperty('winner_id');
      expect(result).toHaveProperty('winner_name');
      expect(result).toHaveProperty('winning_punchline');
      expect(result).toHaveProperty('consensus_method');
    });

    it('judge_round output has all required fields (multiple submissions)', () => {
      const result = contract.judge_round('G1', submissions, 1);
      expect(result).toHaveProperty('winner_id');
      expect(result).toHaveProperty('winner_name');
      expect(result).toHaveProperty('winning_punchline');
      expect(result).toHaveProperty('consensus_method');
      expect(result).toHaveProperty('validators_agreed');
    });

    it('record_game_result output has correct format', () => {
      contract.create_game('G1', 'Alice', 'tech');
      const success = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(success).toHaveProperty('recorded', true);
      expect(success).toHaveProperty('players_updated');
      expect(typeof success.players_updated).toBe('number');

      const skip = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(skip).toHaveProperty('recorded', false);
      expect(skip).toHaveProperty('reason', 'already_finished');
    });

    it('appeal output has correct format', () => {
      const result = contract.appeal_judgment('G1', submissions, 1, 2);
      expect(result).toHaveProperty('new_winner_id');
      expect(result).toHaveProperty('new_winner_name');
      expect(result).toHaveProperty('new_winning_punchline');
      expect(result).toHaveProperty('overturned');
      expect(result).toHaveProperty('consensus_method');
      expect(typeof result.overturned).toBe('boolean');
    });

    it('season archive has correct format', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      const archive = contract.season_reset('S1');
      expect(archive).toHaveProperty('season_id');
      expect(archive).toHaveProperty('leaderboard');
      expect(archive).toHaveProperty('total_games');
      expect(archive).toHaveProperty('total_judgments');
      expect(Array.isArray(archive.leaderboard)).toBe(true);
      for (const entry of archive.leaderboard) {
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('score');
      }
    });

    it('player history has correct format', () => {
      contract.create_game('G1', 'Alice', 'tech');
      const history = contract.get_player_history('Alice');
      expect(history).toHaveProperty('player_name');
      expect(history).toHaveProperty('total_score');
      expect(history).toHaveProperty('games_played');
      expect(history).toHaveProperty('games');
      expect(Array.isArray(history.games)).toBe(true);
      expect(typeof history.total_score).toBe('number');
      expect(typeof history.games_played).toBe('number');
    });
  });

  // =========================================================================
  // JSON safety / edge cases
  // =========================================================================

  describe('Edge cases', () => {
    it('get_game returns null for non-existent game', () => {
      expect(contract.get_game('NOPE')).toBeNull();
    });

    it('get_season returns null for non-existent season', () => {
      expect(contract.get_season('NOPE')).toBeNull();
    });

    it('multiple season resets work independently', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 500 }]);
      contract.season_reset('S1');

      // Play more after reset
      contract.record_game_result('G2', [{ playerName: 'Alice', score: 200 }]);
      const archive2 = contract.season_reset('S2');
      expect(archive2.leaderboard[0].score).toBe(200); // only post-reset score
    });
  });

  // =========================================================================
  // Access Control — SDK-layer enforcement (~2 tests)
  // =========================================================================

  describe('SDK-layer access control', () => {
    it('record_game_result works without caller param (SDK signs tx)', () => {
      contract.create_game('G1', 'Alice', 'tech');
      const result = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(result.recorded).toBe(true);
    });

    it('season_reset works without caller param (SDK signs tx)', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 500 }]);
      const archive = contract.season_reset('S1');
      expect(archive.season_id).toBe('S1');
      expect(archive.leaderboard.length).toBe(1);
    });
  });
});
