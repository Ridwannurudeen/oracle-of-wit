/**
 * Unit tests for Oracle of Wit GenLayer Intelligent Contract logic.
 *
 * The actual contract runs in GenLayer's Python VM with gl.* primitives,
 * so we replicate the core logic in JS to verify correctness without
 * needing a running GenLayer node.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal in-memory replica of the contract state & logic
// ---------------------------------------------------------------------------

class OracleOfWitSim {
  constructor() {
    this.games = {};
    this.leaderboard = {};
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
    const played = Object.values(this.games).filter(
      (g) => g.players && g.players.includes(player_name),
    );
    return {
      player_name,
      total_score: this.leaderboard[player_name] ?? 0,
      games_played: played.length,
      games: played.map((g) => ({
        game_id: g.id,
        category: g.category,
        status: g.status,
      })),
    };
  }

  // -- Write functions ------------------------------------------------------

  create_game(game_id, host_name, category) {
    if (this.games[game_id]) throw new Error('Game ID already exists');
    const state = {
      id: game_id,
      host: host_name,
      category,
      status: 'created',
      rounds_judged: 0,
      players: [host_name],
    };
    this.games[game_id] = state;
    this.total_games += 1;
    return state;
  }

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

    // In the real contract, winner_id comes from gl.eq_principle_strict_eq.
    // Here we accept it as a parameter to test the surrounding logic.
    const winner = submissions.find((s) => s.id === winner_id_from_od) ?? submissions[0];
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
    if (this.games[game_id] && this.games[game_id].status === 'finished') {
      return { recorded: false, reason: 'already_finished' };
    }
    for (const p of final_scores) {
      const current = this.leaderboard[p.playerName] ?? 0;
      this.leaderboard[p.playerName] = current + p.score;
    }
    if (this.games[game_id]) {
      this.games[game_id].status = 'finished';
    }
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
      const old = submissions.find((s) => s.id === original_winner_id);
      const nw = submissions.find((s) => s.id === new_winner_id_from_od);
      if (old) this.leaderboard[old.playerName] = Math.max(0, (this.leaderboard[old.playerName] ?? 0) - 100);
      if (nw) this.leaderboard[nw.playerName] = (this.leaderboard[nw.playerName] ?? 0) + 100;
    }
    this.total_judgments += 1;

    const newWinner = submissions.find((s) => s.id === new_winner_id_from_od);
    return {
      new_winner_id: new_winner_id_from_od,
      new_winner_name: newWinner?.playerName ?? 'Unknown',
      new_winning_punchline: newWinner?.punchline ?? '',
      overturned,
      consensus_method: 'optimistic_democracy_appeal',
    };
  }

  season_reset(season_id) {
    const snapshot = this.get_leaderboard(100);
    const archived = {
      season_id,
      leaderboard: snapshot,
      total_games: this.total_games,
      total_judgments: this.total_judgments,
    };
    // Reset live leaderboard
    for (const key of Object.keys(this.leaderboard)) {
      delete this.leaderboard[key];
    }
    return archived;
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

  // -- Initialization -------------------------------------------------------

  it('initializes with zero state', () => {
    const stats = contract.get_stats();
    expect(stats.total_games).toBe(0);
    expect(stats.total_judgments).toBe(0);
    expect(contract.get_leaderboard()).toEqual([]);
  });

  // -- create_game ----------------------------------------------------------

  describe('create_game', () => {
    it('creates a game and increments total_games', () => {
      const game = contract.create_game('GAME_A1', 'Alice', 'tech');
      expect(game.id).toBe('GAME_A1');
      expect(game.host).toBe('Alice');
      expect(game.category).toBe('tech');
      expect(game.status).toBe('created');
      expect(contract.get_stats().total_games).toBe(1);
    });

    it('rejects duplicate game IDs', () => {
      contract.create_game('GAME_A1', 'Alice', 'tech');
      expect(() => contract.create_game('GAME_A1', 'Bob', 'crypto')).toThrow('Game ID already exists');
    });

    it('stores game retrievable via get_game', () => {
      contract.create_game('GAME_X', 'Host', 'general');
      const fetched = contract.get_game('GAME_X');
      expect(fetched).not.toBeNull();
      expect(fetched.host).toBe('Host');
    });
  });

  // -- judge_round ----------------------------------------------------------

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
      expect(result.winner_name).toBe('Alice');
      expect(result.consensus_method).toBe('single_submission');
    });

    it('selects the OD-chosen winner and updates leaderboard', () => {
      const result = contract.judge_round('G1', submissions, 2);
      expect(result.winner_id).toBe(2);
      expect(result.winner_name).toBe('Bob');
      expect(result.consensus_method).toBe('optimistic_democracy');
      expect(contract.get_leaderboard()[0]).toEqual({ name: 'Bob', score: 100 });
    });

    it('falls back to first submission for invalid winner ID', () => {
      const result = contract.judge_round('G1', submissions, 999);
      expect(result.winner_name).toBe('Alice');
    });

    it('increments total_judgments', () => {
      contract.judge_round('G1', submissions, 1);
      contract.judge_round('G2', submissions, 2);
      expect(contract.get_stats().total_judgments).toBe(2);
    });
  });

  // -- record_game_result ---------------------------------------------------

  describe('record_game_result', () => {
    it('updates leaderboard with final scores', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.record_game_result('G1', [
        { playerName: 'Alice', score: 300 },
        { playerName: 'Bob', score: 150 },
      ]);
      const lb = contract.get_leaderboard();
      expect(lb[0].name).toBe('Alice');
      expect(lb[0].score).toBe(300);
      expect(lb[1].name).toBe('Bob');
    });

    it('marks game as finished', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(contract.get_game('G1').status).toBe('finished');
    });

    it('accumulates scores across multiple games', () => {
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      contract.record_game_result('G2', [{ playerName: 'Alice', score: 200 }]);
      expect(contract.get_leaderboard()[0].score).toBe(300);
    });

    it('is idempotent — second call on finished game returns already_finished', () => {
      contract.create_game('G1', 'Alice', 'tech');
      const first = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(first.recorded).toBe(true);

      const second = contract.record_game_result('G1', [{ playerName: 'Alice', score: 100 }]);
      expect(second.recorded).toBe(false);
      expect(second.reason).toBe('already_finished');

      // Score should not double-count
      expect(contract.get_leaderboard()[0].score).toBe(100);
    });
  });

  // -- appeal_judgment ------------------------------------------------------

  describe('appeal_judgment', () => {
    const submissions = [
      { id: 1, playerName: 'Alice', punchline: 'Joke A' },
      { id: 2, playerName: 'Bob', punchline: 'Joke B' },
    ];

    it('overturns judgment and adjusts leaderboard', () => {
      // Initial win for Alice
      contract.judge_round('G1', submissions, 1);
      expect(contract.get_leaderboard()[0].name).toBe('Alice');

      // Appeal overturns to Bob
      const result = contract.appeal_judgment('G1', submissions, 1, 2);
      expect(result.overturned).toBe(true);
      expect(result.new_winner_name).toBe('Bob');

      const lb = contract.get_leaderboard();
      const bob = lb.find((e) => e.name === 'Bob');
      const alice = lb.find((e) => e.name === 'Alice');
      expect(bob.score).toBe(100);
      expect(alice.score).toBe(0); // 100 - 100
    });

    it('returns overturned=false when same winner', () => {
      const result = contract.appeal_judgment('G1', submissions, 1, 1);
      expect(result.overturned).toBe(false);
    });

    it('handles single submission appeal gracefully', () => {
      const result = contract.appeal_judgment('G1', [submissions[0]], 1, 1);
      expect(result.consensus_method).toBe('single_submission');
    });
  });

  // -- get_player_history ---------------------------------------------------

  describe('get_player_history', () => {
    it('returns empty history for unknown player', () => {
      const history = contract.get_player_history('Nobody');
      expect(history.total_score).toBe(0);
      expect(history.games_played).toBe(0);
      expect(history.games).toEqual([]);
    });

    it('tracks games a player participated in', () => {
      contract.create_game('G1', 'Alice', 'tech');
      contract.create_game('G2', 'Alice', 'crypto');
      contract.record_game_result('G1', [{ playerName: 'Alice', score: 200 }]);

      const history = contract.get_player_history('Alice');
      expect(history.games_played).toBe(2);
      expect(history.total_score).toBe(200);
    });
  });

  // -- season_reset ---------------------------------------------------------

  describe('season_reset', () => {
    it('archives leaderboard and resets scores', () => {
      contract.record_game_result('G1', [
        { playerName: 'Alice', score: 500 },
        { playerName: 'Bob', score: 300 },
      ]);
      expect(contract.get_leaderboard().length).toBe(2);

      const archive = contract.season_reset('2026-03');
      expect(archive.season_id).toBe('2026-03');
      expect(archive.leaderboard.length).toBe(2);
      expect(archive.leaderboard[0].name).toBe('Alice');

      // Live leaderboard is now empty
      expect(contract.get_leaderboard()).toEqual([]);
    });
  });

  // -- JSON safety -----------------------------------------------------------

  describe('JSON safety', () => {
    it('judge_round handles submission with missing playerName without throwing', () => {
      const malformed = [
        { id: 1 },
        { id: 2, playerName: 'Bob', punchline: 'Good joke' },
      ];
      // Should not throw — fallback `submissions[0]` path covers missing fields
      expect(() => contract.judge_round('G1', malformed, 999)).not.toThrow();

      const result = contract.judge_round('G2', malformed, 999);
      // Falls back to submissions[0] because id 999 doesn't exist
      expect(result.winner_id).toBe(1);
      expect(result.winner_name).toBeUndefined();
    });
  });

  // -- get_leaderboard ------------------------------------------------------

  describe('get_leaderboard', () => {
    it('respects the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        contract.record_game_result(`G${i}`, [{ playerName: `P${i}`, score: i * 100 }]);
      }
      expect(contract.get_leaderboard(3).length).toBe(3);
    });

    it('sorts by score descending', () => {
      contract.record_game_result('G1', [
        { playerName: 'Low', score: 10 },
        { playerName: 'High', score: 999 },
        { playerName: 'Mid', score: 500 },
      ]);
      const lb = contract.get_leaderboard();
      expect(lb[0].name).toBe('High');
      expect(lb[2].name).toBe('Low');
    });
  });
});
