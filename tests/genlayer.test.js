/**
 * Unit tests for the GenLayer module (api/_lib/genlayer.js).
 *
 * Covers circuit breaker logic, client caching, readStats,
 * and the main write operations (submitToGenLayer,
 * appealWithGenLayer, pollGenLayerResult).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock genlayer-js SDK — must be at top level (hoisted by vitest)
// ---------------------------------------------------------------------------
const _mockGLClient = {
  writeContract: vi.fn(async () => '0xmocktxhash'),
  readContract: vi.fn(async () => null),
  waitForTransactionReceipt: vi.fn(async () => ({ data: { winner_id: 1 } })),
};

vi.mock('genlayer-js', () => ({
  createClient: () => _mockGLClient,
  createAccount: () => ({ address: '0xmockaddress' }),
}));

vi.mock('genlayer-js/chains', () => ({
  testnetBradbury: { id: 'bradbury-test' },
}));

// ---------------------------------------------------------------------------
// Env vars — must be set before the module is imported
// ---------------------------------------------------------------------------
process.env.GENLAYER_CONTRACT_ADDRESS = '0x1cC5414444E1154B84591f6C6E27959A8EDF4014';
process.env.GENLAYER_PRIVATE_KEY = '0xfake_private_key_for_testing_only';

// ---------------------------------------------------------------------------
// Import module under test (after mocks and env vars)
// ---------------------------------------------------------------------------
const {
  isGenLayerAvailable,
  _resetGLCircuit,
  getGenLayerClient,
  submitToGenLayer,
  appealWithGenLayer,
  pollGenLayerResult,
  readStats,
  createGameOnChain,
  registerRoundOnChain,
  recordResultOnChain,
  finalizeGameOnChain,
  readGameOnChain,
} = await import('../api/_lib/genlayer.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Drive the circuit breaker into the OPEN state by forcing 3 consecutive failures. */
async function tripCircuitBreaker() {
  _mockGLClient.writeContract.mockRejectedValue(new Error('network fail'));
  // 3 failures trip the breaker (CB_THRESHOLD = 3)
  await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g1');
  await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g2');
  await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g3');
  _mockGLClient.writeContract.mockResolvedValue('0xmocktxhash');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenLayer Module', () => {
  beforeEach(() => {
    _resetGLCircuit();
    _mockGLClient.writeContract.mockReset().mockResolvedValue('0xmocktxhash');
    _mockGLClient.readContract.mockReset().mockResolvedValue(null);
    _mockGLClient.waitForTransactionReceipt.mockReset().mockResolvedValue({ data: { winner_id: 1 } });
  });

  // =========================================================================
  // Circuit Breaker
  // =========================================================================

  describe('Circuit Breaker', () => {
    it('isGenLayerAvailable() returns true initially', () => {
      expect(isGenLayerAvailable()).toBe(true);
    });

    it('stays true after 2 consecutive failures (under threshold)', async () => {
      _mockGLClient.writeContract.mockRejectedValue(new Error('fail'));
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g1');
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g2');
      expect(isGenLayerAvailable()).toBe(true);
    });

    it('trips open after 3 consecutive failures', async () => {
      await tripCircuitBreaker();
      expect(isGenLayerAvailable()).toBe(false);
    });

    it('_resetGLCircuit() resets the circuit back to closed', async () => {
      await tripCircuitBreaker();
      expect(isGenLayerAvailable()).toBe(false);

      _resetGLCircuit();
      expect(isGenLayerAvailable()).toBe(true);
    });

    it('a successful call resets consecutive failures', async () => {
      // 2 failures, then 1 success -> counter resets
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g1');
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g2');

      // Success resets counter
      _mockGLClient.writeContract.mockResolvedValueOnce('0xhash');
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g3');

      // 2 more failures should NOT trip the breaker (counter was reset)
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g4');
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      await submitToGenLayer([{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g5');

      expect(isGenLayerAvailable()).toBe(true);
    });

    it('auto-resets after 60s (CB_RESET_MS)', async () => {
      vi.useFakeTimers();
      try {
        await tripCircuitBreaker();
        expect(isGenLayerAvailable()).toBe(false);

        // Advance time past the 60s reset window
        vi.advanceTimersByTime(60_001);

        expect(isGenLayerAvailable()).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does NOT auto-reset before 60s', async () => {
      vi.useFakeTimers();
      try {
        await tripCircuitBreaker();
        expect(isGenLayerAvailable()).toBe(false);

        // Advance time but stay under the threshold
        vi.advanceTimersByTime(59_000);
        expect(isGenLayerAvailable()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('open circuit causes write operations to short-circuit', async () => {
      await tripCircuitBreaker();
      _mockGLClient.writeContract.mockClear();

      const submitResult = await submitToGenLayer(
        [{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g'
      );
      const appealResult = await appealWithGenLayer('game3', 'p', 'c', [], 1);

      expect(submitResult).toBeNull();
      expect(appealResult).toBeNull();

      // writeContract should never have been called — requests were blocked
      expect(_mockGLClient.writeContract).not.toHaveBeenCalled();
    });

    it('open circuit causes readStats to return null', async () => {
      await tripCircuitBreaker();
      _mockGLClient.readContract.mockClear();

      expect(await readStats()).toBeNull();
      expect(_mockGLClient.readContract).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getGenLayerClient
  // =========================================================================

  describe('getGenLayerClient', () => {
    it('returns a client object when env vars are set', async () => {
      const client = await getGenLayerClient();
      expect(client).toBeDefined();
      expect(typeof client.writeContract).toBe('function');
      expect(typeof client.readContract).toBe('function');
    });

    it('returns the cached client on subsequent calls', async () => {
      const client1 = await getGenLayerClient();
      const client2 = await getGenLayerClient();
      expect(client1).toBe(client2);
    });
  });

  // =========================================================================
  // submitToGenLayer
  // =========================================================================

  describe('submitToGenLayer', () => {
    it('submits judge_round and returns txHash on success', async () => {
      const subs = [
        { id: 1, playerName: 'Alice', punchline: 'Why did the coder quit?' },
        { id: 2, playerName: 'Bob', punchline: 'Because they ran out of Java.' },
      ];
      const result = await submitToGenLayer(subs, 'prompt', 'tech', 'GAME_1');

      expect(result).toEqual({ txHash: '0xmocktxhash', onChain: true });
      expect(_mockGLClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'judge_round',
          args: ['GAME_1', 'prompt', 'tech', expect.any(String)],
        })
      );
    });

    it('returns null on SDK error and records failure', async () => {
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('tx reverted'));
      const result = await submitToGenLayer(
        [{ id: 1, playerName: 'A', punchline: 'x' }], 'p', 'c', 'g'
      );
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // pollGenLayerResult
  // =========================================================================

  describe('pollGenLayerResult', () => {
    it('returns null when txHash is falsy', async () => {
      expect(await pollGenLayerResult(null)).toBeNull();
      expect(await pollGenLayerResult('')).toBeNull();
      expect(await pollGenLayerResult(undefined)).toBeNull();
    });

    it('returns {winnerId, commentary} from receipt data (object form)', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({
        data: { winner_id: 42 },
      });
      const result = await pollGenLayerResult('0xhash');
      expect(result).toEqual({ winnerId: 42, commentary: null });
    });

    it('returns {winnerId, commentary} with commentary when present', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({
        data: { winner_id: 42, commentary: { winnerComment: 'Great!', roasts: { 1: 'Ouch' } } },
      });
      const result = await pollGenLayerResult('0xhash');
      expect(result).toEqual({
        winnerId: 42,
        commentary: { winnerComment: 'Great!', roasts: { 1: 'Ouch' } },
      });
    });

    it('returns parsed integer from receipt data (string form)', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({
        data: '7',
      });
      const result = await pollGenLayerResult('0xhash');
      expect(result).toEqual({ winnerId: 7, commentary: null });
    });

    it('returns null when receipt has no data', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({});
      const result = await pollGenLayerResult('0xhash');
      expect(result).toBeNull();
    });

    it('returns null for invalid winner_id (zero)', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({
        data: { winner_id: 0 },
      });
      const result = await pollGenLayerResult('0xhash');
      expect(result).toBeNull();
    });

    it('returns null for invalid winner_id (negative)', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({
        data: { winner_id: -1 },
      });
      const result = await pollGenLayerResult('0xhash');
      expect(result).toBeNull();
    });

    it('returns null for NaN winner_id', async () => {
      _mockGLClient.waitForTransactionReceipt.mockResolvedValueOnce({
        data: 'not-a-number',
      });
      const result = await pollGenLayerResult('0xhash');
      expect(result).toBeNull();
    });

    it('returns null on timeout/failure and records failure', async () => {
      _mockGLClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error('timeout'));
      const result = await pollGenLayerResult('0xhash', 1000);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // appealWithGenLayer
  // =========================================================================

  describe('appealWithGenLayer', () => {
    it('submits appeal_judgment and returns txHash result', async () => {
      const subs = [{ id: 1, playerName: 'A', punchline: 'joke' }];
      const result = await appealWithGenLayer('GAME_3', 'prompt', 'tech', subs, 5);

      expect(result).toEqual({ txHash: '0xmocktxhash', onChain: true });
      expect(_mockGLClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'appeal_judgment',
          args: ['GAME_3', 'prompt', 'tech', expect.any(String), 5],
        })
      );
    });

    it('returns null on SDK error', async () => {
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('appeal fail'));
      const result = await appealWithGenLayer('GAME_3', 'p', 'c', [], 1);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // readStats
  // =========================================================================

  describe('readStats', () => {
    it('calls readContract with get_stats and returns result', async () => {
      const mockStats = { totalGames: 42, totalPlayers: 100 };
      _mockGLClient.readContract.mockResolvedValueOnce(mockStats);

      const result = await readStats();

      expect(result).toEqual(mockStats);
      expect(_mockGLClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'get_stats',
          args: [],
        })
      );
    });

    it('returns null on error (catch path)', async () => {
      _mockGLClient.readContract.mockRejectedValueOnce(new Error('stats fail'));
      const result = await readStats();
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // createGameOnChain
  // =========================================================================

  describe('createGameOnChain', () => {
    it('submits create_game and returns txHash', async () => {
      const players = [{ name: 'Alice' }, { name: 'Bob' }];
      const result = await createGameOnChain('GAME_1', 'Alice', 'tech', 5, players);

      expect(result).toEqual({ txHash: '0xmocktxhash' });
      expect(_mockGLClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'create_game',
          args: ['GAME_1', 'Alice', 'tech', 5, expect.any(String)],
        })
      );
    });

    it('returns null on SDK error', async () => {
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      const result = await createGameOnChain('G1', 'Host', 'tech', 5, []);
      expect(result).toBeNull();
    });

    it('returns null when circuit breaker is open', async () => {
      await tripCircuitBreaker();
      _mockGLClient.writeContract.mockClear();
      const result = await createGameOnChain('G1', 'Host', 'tech', 5, []);
      expect(result).toBeNull();
      expect(_mockGLClient.writeContract).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // registerRoundOnChain
  // =========================================================================

  describe('registerRoundOnChain', () => {
    it('submits register_round and returns txHash', async () => {
      const subs = [{ id: 1, playerName: 'Alice', punchline: 'Joke' }];
      const result = await registerRoundOnChain('GAME_1', 1, 'Why did...', subs);

      expect(result).toEqual({ txHash: '0xmocktxhash' });
      expect(_mockGLClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'register_round',
          args: ['GAME_1', 1, 'Why did...', expect.any(String)],
        })
      );
    });

    it('returns null on SDK error', async () => {
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      const result = await registerRoundOnChain('G1', 1, 'setup', []);
      expect(result).toBeNull();
    });

    it('returns null when circuit breaker is open', async () => {
      await tripCircuitBreaker();
      _mockGLClient.writeContract.mockClear();
      const result = await registerRoundOnChain('G1', 1, 'setup', []);
      expect(result).toBeNull();
      expect(_mockGLClient.writeContract).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // recordResultOnChain
  // =========================================================================

  describe('recordResultOnChain', () => {
    it('submits record_result and returns txHash', async () => {
      const result = await recordResultOnChain('GAME_1', 1, 2, 'Bob', { Bob: 100 }, 'genlayer_od');

      expect(result).toEqual({ txHash: '0xmocktxhash' });
      expect(_mockGLClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'record_result',
          args: ['GAME_1', 1, 2, 'Bob', expect.any(String), 'genlayer_od'],
        })
      );
    });

    it('returns null on SDK error', async () => {
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      const result = await recordResultOnChain('G1', 1, 1, 'Alice', {}, 'coin_flip');
      expect(result).toBeNull();
    });

    it('returns null when circuit breaker is open', async () => {
      await tripCircuitBreaker();
      _mockGLClient.writeContract.mockClear();
      const result = await recordResultOnChain('G1', 1, 1, 'Alice', {}, 'od');
      expect(result).toBeNull();
      expect(_mockGLClient.writeContract).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // finalizeGameOnChain
  // =========================================================================

  describe('finalizeGameOnChain', () => {
    it('submits finalize_game and returns txHash', async () => {
      const standings = [{ name: 'Alice', score: 300, isBot: false }];
      const result = await finalizeGameOnChain('GAME_1', 'Alice', standings);

      expect(result).toEqual({ txHash: '0xmocktxhash' });
      expect(_mockGLClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'finalize_game',
          args: ['GAME_1', 'Alice', expect.any(String)],
        })
      );
    });

    it('returns null on SDK error', async () => {
      _mockGLClient.writeContract.mockRejectedValueOnce(new Error('fail'));
      const result = await finalizeGameOnChain('G1', 'Alice', []);
      expect(result).toBeNull();
    });

    it('returns null when circuit breaker is open', async () => {
      await tripCircuitBreaker();
      _mockGLClient.writeContract.mockClear();
      const result = await finalizeGameOnChain('G1', 'Alice', []);
      expect(result).toBeNull();
      expect(_mockGLClient.writeContract).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // readGameOnChain
  // =========================================================================

  describe('readGameOnChain', () => {
    it('calls readContract with get_game and returns result', async () => {
      const mockGame = { game_id: 'G1', game_data: '{}' };
      _mockGLClient.readContract.mockResolvedValueOnce(mockGame);

      const result = await readGameOnChain('G1');

      expect(result).toEqual(mockGame);
      expect(_mockGLClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'get_game',
          args: ['G1'],
        })
      );
    });

    it('returns null on error', async () => {
      _mockGLClient.readContract.mockRejectedValueOnce(new Error('fail'));
      const result = await readGameOnChain('G1');
      expect(result).toBeNull();
    });

    it('returns null when circuit breaker is open', async () => {
      await tripCircuitBreaker();
      _mockGLClient.readContract.mockClear();
      const result = await readGameOnChain('G1');
      expect(result).toBeNull();
      expect(_mockGLClient.readContract).not.toHaveBeenCalled();
    });
  });
});
