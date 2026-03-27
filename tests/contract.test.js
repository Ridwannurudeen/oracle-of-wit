/**
 * Unit tests for Oracle of Wit GenLayer Intelligent Contract logic.
 *
 * The actual contract runs in GenLayer's Python VM with gl.* primitives,
 * so we replicate the core logic in JS to verify correctness without
 * needing a running GenLayer node.
 *
 * Covers: get_stats, judge_round, appeal_judgment, record_game_count,
 * create_game, register_round, record_result, finalize_game, get_game.
 *
 * Note: TreeMap[str, ...] is not yet supported on Bradbury testnet.
 * Leaderboard, profiles, game history, hall of fame, prompt pool, and
 * seasons are managed by Redis + the backend until TreeMap stabilizes.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal in-memory replica of the contract state & logic
//
// Mirrors contracts/oracle_of_wit.py as closely as possible.
// Storage is minimal (counters only) — game state lives in Redis.
// ---------------------------------------------------------------------------

class OracleOfWitSim {
  constructor() {
    this.total_games = 0;
    this.total_judgments = 0;
    this.total_appeals = 0;
    this.current_game_id = '';
    this.current_game_data = '';
    this.current_round_submissions = '';
    this.current_round_result = '';
    this.last_finalized_game = '';
  }

  // -- View functions -------------------------------------------------------

  get_stats() {
    return {
      total_games: this.total_games,
      total_judgments: this.total_judgments,
      total_appeals: this.total_appeals,
      current_game_id: this.current_game_id,
    };
  }

  get_game(game_id) {
    if (this.current_game_id !== game_id) {
      return { error: 'Game not found or not active' };
    }
    return {
      game_id: this.current_game_id,
      game_data: this.current_game_data,
      round_submissions: this.current_round_submissions,
      round_result: this.current_round_result,
    };
  }

  create_game(game_id, host, category, num_rounds, players) {
    this.total_games += 1;
    this.current_game_id = game_id;
    this.current_game_data = JSON.stringify({
      host, category, num_rounds, status: 'active', players, created_at: game_id,
    });
    this.current_round_submissions = '';
    this.current_round_result = '';
    return { game_id, total_games: this.total_games };
  }

  register_round(game_id, round_num, joke_setup, submissions) {
    this.current_round_submissions = JSON.stringify({
      game_id, round_num, joke_setup, submissions,
    });
    return { game_id, round_num, recorded: true };
  }

  record_result(game_id, round_num, winner_id, winner_name, scores, judging_method) {
    this.current_round_result = JSON.stringify({
      game_id, round_num, winner_id, winner_name, scores, judging_method,
    });
    return { game_id, round_num, winner_id, recorded: true };
  }

  finalize_game(game_id, winner_name, final_standings) {
    this.last_finalized_game = JSON.stringify({
      game_id, winner_name, final_standings, status: 'completed',
    });
    if (this.current_game_id === game_id) {
      try {
        const data = JSON.parse(this.current_game_data);
        data.status = 'completed';
        this.current_game_data = JSON.stringify(data);
      } catch (e) { /* ignore */ }
    }
    return { game_id, winner_name, finalized: true };
  }

  // -- Write functions ------------------------------------------------------

  /**
   * Judge a round. In the real contract the winner_id comes from
   * gl.eq_principle_prompt_comparative; here we accept it as a parameter.
   */
  judge_round(game_id, submissions, winner_id_from_od) {
    if (submissions.length === 0) throw new Error('No submissions to judge');

    if (submissions.length === 1) {
      this.total_judgments += 1;
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

    // Update stats (no leaderboard — TreeMap not supported)
    this.total_judgments += 1;

    return {
      winner_id: winner.id,
      winner_name: winner.playerName,
      winning_punchline: winner.punchline,
      consensus_method: 'optimistic_democracy',
      validators_agreed: true,
      commentary: { winnerComment: 'Great joke!', roasts: {} },
    };
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
    this.total_judgments += 1;
    this.total_appeals += 1;

    const newWinnerSub = submissions.find((s) => s.id === new_winner_id_from_od);
    return {
      new_winner_id: new_winner_id_from_od,
      new_winner_name: newWinnerSub?.playerName ?? 'Unknown',
      new_winning_punchline: newWinnerSub?.punchline ?? '',
      overturned,
      consensus_method: 'optimistic_democracy_appeal',
    };
  }

  record_game_count() {
    this.total_games += 1;
    return { total_games: this.total_games };
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
    expect(stats.total_appeals).toBe(0);
    expect(stats.current_game_id).toBe('');
  });

  // =========================================================================
  // get_stats
  // =========================================================================

  describe('get_stats', () => {
    it('returns all stat fields', () => {
      const stats = contract.get_stats();
      expect(stats).toHaveProperty('total_games');
      expect(stats).toHaveProperty('total_judgments');
      expect(stats).toHaveProperty('total_appeals');
      expect(stats).toHaveProperty('current_game_id');
      expect(typeof stats.total_games).toBe('number');
      expect(typeof stats.total_judgments).toBe('number');
      expect(typeof stats.total_appeals).toBe('number');
    });

    it('reflects changes after judging and recording', () => {
      contract.record_game_count();
      contract.judge_round('G1', [
        { id: 1, playerName: 'Alice', punchline: 'A' },
        { id: 2, playerName: 'Bob', punchline: 'B' },
      ], 1);
      const stats = contract.get_stats();
      expect(stats.total_games).toBe(1);
      expect(stats.total_judgments).toBe(1);
    });

    it('reflects current_game_id after create_game', () => {
      contract.create_game('GAME_X', 'Host', 'tech', 5, ['Host', 'Player2']);
      const stats = contract.get_stats();
      expect(stats.current_game_id).toBe('GAME_X');
    });

    it('reflects total_appeals after appeal_judgment', () => {
      const subs = [
        { id: 1, playerName: 'Alice', punchline: 'A' },
        { id: 2, playerName: 'Bob', punchline: 'B' },
      ];
      contract.appeal_judgment('G1', subs, 1, 2);
      expect(contract.get_stats().total_appeals).toBe(1);
    });
  });

  // =========================================================================
  // judge_round
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

    it('increments total_judgments for single submission', () => {
      contract.judge_round('G1', [submissions[0]], 1);
      expect(contract.get_stats().total_judgments).toBe(1);
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
  });

  // =========================================================================
  // judge_round commentary
  // =========================================================================

  describe('judge_round commentary', () => {
    const submissions = [
      { id: 1, playerName: 'Alice', punchline: 'Joke A' },
      { id: 2, playerName: 'Bob', punchline: 'Joke B' },
    ];

    it('returns commentary object in result', () => {
      const result = contract.judge_round('G1', submissions, 1);
      expect(result).toHaveProperty('commentary');
      expect(result.commentary).toHaveProperty('winnerComment');
      expect(result.commentary).toHaveProperty('roasts');
    });

    it('commentary is present alongside winner info', () => {
      const result = contract.judge_round('G1', submissions, 2);
      expect(result.winner_id).toBe(2);
      expect(result.commentary.winnerComment).toBeDefined();
    });
  });

  // =========================================================================
  // appeal_judgment
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

    it('increments total_judgments on appeal', () => {
      contract.appeal_judgment('G1', submissions, 1, 2);
      expect(contract.get_stats().total_judgments).toBe(1);
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
  // record_game_count
  // =========================================================================

  describe('record_game_count', () => {
    it('increments total_games by 1', () => {
      const result = contract.record_game_count();
      expect(result.total_games).toBe(1);
      expect(contract.get_stats().total_games).toBe(1);
    });

    it('increments total_games cumulatively', () => {
      contract.record_game_count();
      contract.record_game_count();
      contract.record_game_count();
      expect(contract.get_stats().total_games).toBe(3);
    });

    it('returns the new total_games count', () => {
      contract.record_game_count();
      const result = contract.record_game_count();
      expect(result.total_games).toBe(2);
    });

    it('does not affect total_judgments', () => {
      contract.record_game_count();
      expect(contract.get_stats().total_judgments).toBe(0);
    });
  });

  // =========================================================================
  // Data Structure Validation
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

    it('appeal output has correct format', () => {
      const result = contract.appeal_judgment('G1', submissions, 1, 2);
      expect(result).toHaveProperty('new_winner_id');
      expect(result).toHaveProperty('new_winner_name');
      expect(result).toHaveProperty('new_winning_punchline');
      expect(result).toHaveProperty('overturned');
      expect(result).toHaveProperty('consensus_method');
      expect(typeof result.overturned).toBe('boolean');
    });

    it('record_game_count output has correct format', () => {
      const result = contract.record_game_count();
      expect(result).toHaveProperty('total_games');
      expect(typeof result.total_games).toBe('number');
    });

    it('get_stats output has correct format', () => {
      const stats = contract.get_stats();
      expect(stats).toHaveProperty('total_games');
      expect(stats).toHaveProperty('total_judgments');
      expect(stats).toHaveProperty('total_appeals');
      expect(stats).toHaveProperty('current_game_id');
      expect(typeof stats.total_games).toBe('number');
      expect(typeof stats.total_judgments).toBe('number');
    });
  });

  // =========================================================================
  // create_game
  // =========================================================================

  describe('create_game', () => {
    it('registers a game and increments total_games', () => {
      const result = contract.create_game('GAME_1', 'Alice', 'tech', 5, ['Alice', 'Bob']);
      expect(result.game_id).toBe('GAME_1');
      expect(result.total_games).toBe(1);
      expect(contract.get_stats().total_games).toBe(1);
    });

    it('sets current_game_id', () => {
      contract.create_game('GAME_1', 'Alice', 'tech', 5, ['Alice']);
      expect(contract.current_game_id).toBe('GAME_1');
    });

    it('stores game data as JSON', () => {
      contract.create_game('GAME_1', 'Alice', 'crypto', 3, ['Alice', 'Bob']);
      const data = JSON.parse(contract.current_game_data);
      expect(data.host).toBe('Alice');
      expect(data.category).toBe('crypto');
      expect(data.num_rounds).toBe(3);
      expect(data.status).toBe('active');
      expect(data.players).toEqual(['Alice', 'Bob']);
    });

    it('resets round data on new game', () => {
      contract.register_round('G1', 1, 'setup', [{ id: 1, punchline: 'x' }]);
      contract.create_game('G2', 'Alice', 'tech', 5, ['Alice']);
      expect(contract.current_round_submissions).toBe('');
      expect(contract.current_round_result).toBe('');
    });

    it('increments total_games cumulatively', () => {
      contract.create_game('G1', 'A', 'tech', 5, ['A']);
      contract.create_game('G2', 'B', 'tech', 5, ['B']);
      expect(contract.get_stats().total_games).toBe(2);
    });
  });

  // =========================================================================
  // register_round
  // =========================================================================

  describe('register_round', () => {
    it('records submissions and returns confirmation', () => {
      const subs = [{ id: 1, playerName: 'Alice', punchline: 'Joke A' }];
      const result = contract.register_round('G1', 1, 'Why did...', subs);
      expect(result.game_id).toBe('G1');
      expect(result.round_num).toBe(1);
      expect(result.recorded).toBe(true);
    });

    it('stores round submissions as JSON', () => {
      const subs = [
        { id: 1, playerName: 'Alice', punchline: 'A' },
        { id: 2, playerName: 'Bob', punchline: 'B' },
      ];
      contract.register_round('G1', 2, 'What is...', subs);
      const data = JSON.parse(contract.current_round_submissions);
      expect(data.game_id).toBe('G1');
      expect(data.round_num).toBe(2);
      expect(data.joke_setup).toBe('What is...');
      expect(data.submissions).toHaveLength(2);
    });

    it('overwrites previous round submissions', () => {
      contract.register_round('G1', 1, 'setup1', [{ id: 1 }]);
      contract.register_round('G1', 2, 'setup2', [{ id: 2 }]);
      const data = JSON.parse(contract.current_round_submissions);
      expect(data.round_num).toBe(2);
    });
  });

  // =========================================================================
  // record_result
  // =========================================================================

  describe('record_result', () => {
    it('records round result and returns confirmation', () => {
      const result = contract.record_result('G1', 1, 2, 'Bob', { Alice: 0, Bob: 100 }, 'genlayer_optimistic_democracy');
      expect(result.game_id).toBe('G1');
      expect(result.round_num).toBe(1);
      expect(result.winner_id).toBe(2);
      expect(result.recorded).toBe(true);
    });

    it('stores result as JSON', () => {
      contract.record_result('G1', 3, 1, 'Alice', { Alice: 100 }, 'coin_flip');
      const data = JSON.parse(contract.current_round_result);
      expect(data.winner_name).toBe('Alice');
      expect(data.judging_method).toBe('coin_flip');
      expect(data.scores.Alice).toBe(100);
    });
  });

  // =========================================================================
  // finalize_game
  // =========================================================================

  describe('finalize_game', () => {
    it('records final standings and returns confirmation', () => {
      const standings = [{ name: 'Alice', score: 300 }, { name: 'Bob', score: 200 }];
      const result = contract.finalize_game('G1', 'Alice', standings);
      expect(result.game_id).toBe('G1');
      expect(result.winner_name).toBe('Alice');
      expect(result.finalized).toBe(true);
    });

    it('stores last finalized game as JSON', () => {
      const standings = [{ name: 'Alice', score: 300 }];
      contract.finalize_game('G1', 'Alice', standings);
      const data = JSON.parse(contract.last_finalized_game);
      expect(data.game_id).toBe('G1');
      expect(data.status).toBe('completed');
      expect(data.final_standings).toHaveLength(1);
    });

    it('updates current game status to completed', () => {
      contract.create_game('G1', 'Alice', 'tech', 5, ['Alice']);
      contract.finalize_game('G1', 'Alice', [{ name: 'Alice', score: 100 }]);
      const data = JSON.parse(contract.current_game_data);
      expect(data.status).toBe('completed');
    });

    it('does not update current game data for a different game', () => {
      contract.create_game('G1', 'Alice', 'tech', 5, ['Alice']);
      contract.finalize_game('G2', 'Bob', [{ name: 'Bob', score: 50 }]);
      const data = JSON.parse(contract.current_game_data);
      expect(data.status).toBe('active');
    });
  });

  // =========================================================================
  // get_game
  // =========================================================================

  describe('get_game', () => {
    it('returns game data for active game', () => {
      contract.create_game('G1', 'Alice', 'tech', 5, ['Alice', 'Bob']);
      const result = contract.get_game('G1');
      expect(result.game_id).toBe('G1');
      expect(result.game_data).toBeTruthy();
    });

    it('returns error for non-active game', () => {
      contract.create_game('G1', 'Alice', 'tech', 5, ['Alice']);
      const result = contract.get_game('NONEXISTENT');
      expect(result.error).toBeTruthy();
    });

    it('includes round submissions and result', () => {
      contract.create_game('G1', 'Alice', 'tech', 5, ['Alice']);
      contract.register_round('G1', 1, 'setup', [{ id: 1 }]);
      contract.record_result('G1', 1, 1, 'Alice', { Alice: 100 }, 'od');
      const result = contract.get_game('G1');
      expect(result.round_submissions).toBeTruthy();
      expect(result.round_result).toBeTruthy();
    });
  });

  // =========================================================================
  // Full Game Lifecycle
  // =========================================================================

  describe('Full game lifecycle', () => {
    it('create → register → judge → record → finalize flows correctly', () => {
      const players = ['Alice', 'Bob'];
      const submissions = [
        { id: 1, playerName: 'Alice', punchline: 'Joke A' },
        { id: 2, playerName: 'Bob', punchline: 'Joke B' },
      ];

      // Create game
      const createResult = contract.create_game('LIFECYCLE', 'Alice', 'tech', 2, players);
      expect(createResult.total_games).toBe(1);

      // Round 1: register, judge, record
      contract.register_round('LIFECYCLE', 1, 'Why did...', submissions);
      const judgeResult = contract.judge_round('LIFECYCLE', submissions, 1);
      expect(judgeResult.winner_id).toBe(1);
      contract.record_result('LIFECYCLE', 1, 1, 'Alice', { Alice: 100, Bob: 0 }, 'genlayer_optimistic_democracy');

      // Round 2: register, judge, record
      contract.register_round('LIFECYCLE', 2, 'What is...', submissions);
      contract.judge_round('LIFECYCLE', submissions, 2);
      contract.record_result('LIFECYCLE', 2, 2, 'Bob', { Alice: 0, Bob: 100 }, 'genlayer_optimistic_democracy');

      // Finalize
      const finalResult = contract.finalize_game('LIFECYCLE', 'Alice', [
        { name: 'Alice', score: 200 },
        { name: 'Bob', score: 100 },
      ]);
      expect(finalResult.finalized).toBe(true);

      // Verify final state
      const stats = contract.get_stats();
      expect(stats.total_games).toBe(1);
      expect(stats.total_judgments).toBe(2);
      expect(stats.current_game_id).toBe('LIFECYCLE');

      const gameData = JSON.parse(contract.current_game_data);
      expect(gameData.status).toBe('completed');

      const finalGame = JSON.parse(contract.last_finalized_game);
      expect(finalGame.winner_name).toBe('Alice');
      expect(finalGame.final_standings).toHaveLength(2);
    });
  });
});
