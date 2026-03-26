/**
 * Unit tests for Oracle of Wit GenLayer Intelligent Contract logic.
 *
 * The actual contract runs in GenLayer's Python VM with gl.* primitives,
 * so we replicate the core logic in JS to verify correctness without
 * needing a running GenLayer node.
 *
 * Covers: get_stats, judge_round, appeal_judgment, record_game_count.
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
  }

  // -- View functions -------------------------------------------------------

  get_stats() {
    return {
      total_games: this.total_games,
      total_judgments: this.total_judgments,
    };
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
  });

  // =========================================================================
  // get_stats
  // =========================================================================

  describe('get_stats', () => {
    it('returns total_games and total_judgments', () => {
      const stats = contract.get_stats();
      expect(stats).toHaveProperty('total_games');
      expect(stats).toHaveProperty('total_judgments');
      expect(typeof stats.total_games).toBe('number');
      expect(typeof stats.total_judgments).toBe('number');
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
      expect(typeof stats.total_games).toBe('number');
      expect(typeof stats.total_judgments).toBe('number');
    });
  });
});
