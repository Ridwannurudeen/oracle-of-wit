/**
 * Integration tests for Oracle of Wit API handler.
 *
 * These tests import the handler directly and mock Redis + external services
 * so we can verify the full request → response cycle without real infra.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory store that replaces Upstash Redis
// ---------------------------------------------------------------------------
const store = {};

function resetStore() {
  for (const k of Object.keys(store)) delete store[k];
}

// Mock fetch globally so Upstash REST calls hit our in-memory store
globalThis.fetch = vi.fn(async (url, opts) => {
  const urlStr = typeof url === 'string' ? url : url.toString();

  // Upstash REST interface: POST with body [command, ...args]
  if (opts?.method === 'POST' || opts?.body) {
    const body = JSON.parse(opts.body);
    const [cmd, ...args] = body;

    if (cmd === 'GET') {
      const val = store[args[0]];
      return { ok: true, json: async () => ({ result: val ?? null }) };
    }
    if (cmd === 'SET') {
      store[args[0]] = args[1];
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    if (cmd === 'SCAN') {
      const pattern = args[1]; // MATCH pattern
      const regex = new RegExp('^' + (pattern || '*').replace(/\*/g, '.*') + '$');
      const keys = Object.keys(store).filter((k) => regex.test(k));
      return { ok: true, json: async () => ({ result: ['0', keys] }) };
    }
  }

  // Anthropic API — return a canned winner
  if (urlStr.includes('anthropic.com')) {
    return {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"winner_id": 1, "roast": "Nice one!"}' }],
      }),
    };
  }

  return { ok: false, json: async () => ({ error: 'unmocked' }) };
});

// Stub env vars so the handler doesn't bail out
process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
process.env.ANTHROPIC_API_KEY = 'sk-ant-fake';

// Import the handler. Because game.js uses dynamic import() for genlayer-js,
// and we don't have it installed in test, GenLayer calls will gracefully return null.
const { default: handler } = await import('../api/game.js');

// ---------------------------------------------------------------------------
// Helpers to simulate Vercel req/res
// ---------------------------------------------------------------------------

function makeReq({ method = 'POST', query = {}, body = {} } = {}) {
  return { method, query, body };
}

function makeRes() {
  const res = {
    _status: 200,
    _headers: {},
    _body: null,
    _sent: false,
    status(code) { res._status = code; return res; },
    setHeader(k, v) { res._headers[k] = v; return res; },
    json(data) { res._body = data; res._sent = true; return res; },
    send(data) { res._body = data; res._sent = true; return res; },
    end() { res._sent = true; return res; },
  };
  return res;
}

async function call(action, body = {}, method = 'POST') {
  const req = makeReq({ method, query: { action }, body });
  const res = makeRes();
  await handler(req, res);
  return { status: res._status, body: res._body };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Handler', () => {
  beforeEach(() => {
    resetStore();
  });

  // -- CORS / OPTIONS -------------------------------------------------------

  it('responds 200 to OPTIONS preflight', async () => {
    const req = makeReq({ method: 'OPTIONS', query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
  });

  // -- createRoom -----------------------------------------------------------

  describe('createRoom', () => {
    it('creates a room and returns roomId', async () => {
      const { status, body } = await call('createRoom', { hostName: 'Alice', category: 'tech' });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.roomId).toMatch(/^GAME_/);
      expect(body.room.host).toBe('Alice');
      expect(body.room.category).toBe('tech');
      expect(body.room.players.length).toBe(1);
    });

    it('requires hostName', async () => {
      const { status, body } = await call('createRoom', {});
      expect(status).toBe(400);
      expect(body.error).toMatch(/hostName/i);
    });

    it('adds bots in single-player mode', async () => {
      const { body } = await call('createRoom', { hostName: 'Solo', category: 'general', singlePlayer: true });
      expect(body.room.isSinglePlayer).toBe(true);
      expect(body.room.players.length).toBe(4); // 1 host + 3 bots
      expect(body.room.players.filter((p) => p.isBot).length).toBe(3);
    });
  });

  // -- joinRoom -------------------------------------------------------------

  describe('joinRoom', () => {
    let roomId;

    beforeEach(async () => {
      const { body } = await call('createRoom', { hostName: 'Host' });
      roomId = body.roomId;
    });

    it('adds a player to an existing room', async () => {
      const { status, body } = await call('joinRoom', { roomId, playerName: 'Bob' });
      expect(status).toBe(200);
      expect(body.room.players.length).toBe(2);
    });

    it('rejects duplicate player names', async () => {
      await call('joinRoom', { roomId, playerName: 'Bob' });
      const { status, body } = await call('joinRoom', { roomId, playerName: 'Bob' });
      expect(status).toBe(400);
      expect(body.error).toMatch(/already/i);
    });

    it('rejects join on non-existent room', async () => {
      const { status } = await call('joinRoom', { roomId: 'FAKE_ROOM', playerName: 'X' });
      expect(status).toBe(404);
    });

    it('allows spectator join', async () => {
      const { status, body } = await call('joinRoom', { roomId, playerName: 'Spectator', spectator: true });
      expect(status).toBe(200);
      expect(body.spectating).toBe(true);
    });
  });

  // -- getRoom --------------------------------------------------------------

  describe('getRoom', () => {
    it('returns the room state', async () => {
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;

      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._body.room.id).toBe(roomId);
    });

    it('returns 404 for missing room', async () => {
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId: 'NOPE' } });
      const res = makeRes();
      await handler(req, res);
      expect(res._status).toBe(404);
    });
  });

  // -- submitPunchline ------------------------------------------------------

  describe('submitPunchline', () => {
    let roomId;

    beforeEach(async () => {
      const { body } = await call('createRoom', { hostName: 'Host' });
      roomId = body.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      // Start game to enter submitting phase
      await call('startGame', { roomId, hostName: 'Host' });
    });

    it('accepts a punchline during submitting phase', async () => {
      const { status, body } = await call('submitPunchline', {
        roomId,
        playerName: 'Host',
        punchline: 'Because light attracts bugs!',
      });
      expect(status).toBe(200);
      expect(body.submissionCount).toBe(1);
    });

    it('rejects duplicate submission from same player', async () => {
      await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Joke 1' });
      const { status, body } = await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Joke 2' });
      expect(status).toBe(400);
      expect(body.error).toMatch(/already/i);
    });

    it('rejects submission from non-player', async () => {
      const { status } = await call('submitPunchline', { roomId, playerName: 'Stranger', punchline: 'Hi' });
      expect(status).toBe(403);
    });
  });

  // -- placeBet -------------------------------------------------------------

  describe('placeBet', () => {
    let roomId;

    beforeEach(async () => {
      const { body } = await call('createRoom', { hostName: 'Host' });
      roomId = body.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });
      // Submit punchlines from both players
      await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Joke A' });
      await call('submitPunchline', { roomId, playerName: 'Player2', punchline: 'Joke B' });
      // Advance to betting phase
      await call('advancePhase', { roomId, hostName: 'Host' });
    });

    it('accepts a bet during betting phase', async () => {
      const { status, body } = await call('placeBet', {
        roomId,
        playerName: 'Host',
        submissionId: 2,
        amount: 50,
      });
      expect(status).toBe(200);
      expect(body.betCount).toBe(1);
    });

    it('rejects duplicate bet from same player', async () => {
      await call('placeBet', { roomId, playerName: 'Host', submissionId: 1, amount: 50 });
      const { status } = await call('placeBet', { roomId, playerName: 'Host', submissionId: 2, amount: 50 });
      expect(status).toBe(400);
    });
  });

  // -- advancePhase ---------------------------------------------------------

  describe('advancePhase', () => {
    let roomId;

    beforeEach(async () => {
      const { body } = await call('createRoom', { hostName: 'Host' });
      roomId = body.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });
    });

    it('only host can advance', async () => {
      const { status, body } = await call('advancePhase', { roomId, hostName: 'NotHost' });
      expect(status).toBe(403);
      expect(body.error).toMatch(/host/i);
    });

    it('advances from submitting phase', async () => {
      await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'A' });
      await call('submitPunchline', { roomId, playerName: 'Player2', punchline: 'B' });
      const { status, body } = await call('advancePhase', { roomId, hostName: 'Host' });
      expect(status).toBe(200);
      // Should have moved to betting (for <8 submissions)
      expect(['betting', 'curating', 'judging', 'roundResults']).toContain(body.room.status);
    });
  });

  // -- listRooms ------------------------------------------------------------

  describe('listRooms', () => {
    it('returns empty list when no rooms exist', async () => {
      const req = makeReq({ method: 'GET', query: { action: 'listRooms' } });
      const res = makeRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(Array.isArray(res._body.rooms)).toBe(true);
    });
  });

  // -- getLeaderboard -------------------------------------------------------

  describe('getLeaderboard', () => {
    it('returns leaderboard array', async () => {
      const req = makeReq({ method: 'GET', query: { action: 'getLeaderboard' } });
      const res = makeRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(Array.isArray(res._body.leaderboard)).toBe(true);
    });
  });

  // -- unknown action -------------------------------------------------------

  it('returns 400 for unknown action', async () => {
    const { status, body } = await call('nonExistentAction');
    expect(status).toBe(400);
    expect(body.error).toMatch(/unknown/i);
  });
});
