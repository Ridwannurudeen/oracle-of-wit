/**
 * Shared test infrastructure for Oracle of Wit.
 *
 * Provides an in-memory Redis mock, session token management,
 * request/response helpers, and room setup utilities so multiple
 * test files can reuse the same foundation.
 */
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory store that replaces Upstash Redis
// ---------------------------------------------------------------------------
export const store = {};
export const counters = {};
export const sortedSets = {}; // key -> [{ score, member }]

export function resetStore() {
  for (const k of Object.keys(store)) delete store[k];
  for (const k of Object.keys(counters)) delete counters[k];
  for (const k of Object.keys(sortedSets)) delete sortedSets[k];
}

// ---------------------------------------------------------------------------
// Session token auto-injection / capture
// ---------------------------------------------------------------------------
export const tokens = {};

export function resetTokens() {
  for (const k of Object.keys(tokens)) delete tokens[k];
}

// ---------------------------------------------------------------------------
// Mock fetch globally — Upstash REST URL format + Anthropic canned response
// ---------------------------------------------------------------------------
export function installFetchMock() {
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // ---- Anthropic API — return a canned winner ----
    if (urlStr.includes('anthropic.com')) {
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"winner_id": 1, "roast": "Nice one!"}' }],
        }),
      };
    }

    // ---- Upstash REST interface ----
    if (urlStr.startsWith('https://fake.upstash.io')) {
      const parsed = new URL(urlStr);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const command = (segments[0] || '').toLowerCase();

      if (command === 'get') {
        const key = decodeURIComponent(segments.slice(1).join('/'));
        const val = store[key] ?? null;
        return { ok: true, json: async () => ({ result: val }) };
      }

      if (command === 'set') {
        const hasNX = parsed.search.includes('NX');

        if (hasNX) {
          const key = decodeURIComponent(segments[1]);
          if (store[key] !== undefined) {
            return { ok: true, json: async () => ({ result: null }) };
          }
          const inlineVal = segments.slice(2).join('/');
          store[key] = inlineVal || opts.body || '1';
          return { ok: true, json: async () => ({ result: 'OK' }) };
        }

        const key = decodeURIComponent(segments.slice(1).join('/'));
        store[key] = opts.body;
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }

      if (command === 'keys') {
        const pattern = decodeURIComponent(segments.slice(1).join('/'));
        const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        const keys = Object.keys(store).filter((k) => regex.test(k));
        return { ok: true, json: async () => ({ result: keys }) };
      }

      if (command === 'incr') {
        const key = decodeURIComponent(segments.slice(1).join('/'));
        counters[key] = (counters[key] || 0) + 1;
        return { ok: true, json: async () => ({ result: counters[key] }) };
      }

      if (command === 'expire') {
        return { ok: true, json: async () => ({ result: 1 }) };
      }

      if (command === 'del') {
        const key = decodeURIComponent(segments.slice(1).join('/'));
        delete store[key];
        return { ok: true, json: async () => ({ result: 1 }) };
      }

      if (command === 'zadd') {
        const key = decodeURIComponent(segments[1]);
        const score = parseFloat(segments[2]);
        const member = decodeURIComponent(segments[3]);
        if (!sortedSets[key]) sortedSets[key] = [];
        const existing = sortedSets[key].find(e => e.member === member);
        if (existing) { existing.score = score; } else { sortedSets[key].push({ score, member }); }
        return { ok: true, json: async () => ({ result: existing ? 0 : 1 }) };
      }

      if (command === 'zrem') {
        const key = decodeURIComponent(segments[1]);
        const member = decodeURIComponent(segments[2]);
        if (!sortedSets[key]) return { ok: true, json: async () => ({ result: 0 }) };
        const before = sortedSets[key].length;
        sortedSets[key] = sortedSets[key].filter(e => e.member !== member);
        return { ok: true, json: async () => ({ result: before - sortedSets[key].length }) };
      }

      if (command === 'zrevrange') {
        const key = decodeURIComponent(segments[1]);
        const start = parseInt(segments[2], 10);
        const stop = parseInt(segments[3], 10);
        const set = sortedSets[key] || [];
        const sorted = [...set].sort((a, b) => b.score - a.score);
        const sliced = sorted.slice(start, stop + 1).map(e => e.member);
        return { ok: true, json: async () => ({ result: sliced }) };
      }

      // Fallback for unhandled Upstash commands
      return { ok: true, json: async () => ({ result: null }) };
    }

    return { ok: false, json: async () => ({ error: 'unmocked' }) };
  });
}

// Install fetch mock immediately on import
installFetchMock();

// Stub env vars so the handler doesn't bail out
process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
process.env.ANTHROPIC_API_KEY = 'sk-ant-fake';

// Import the handler and redis utilities
const { default: handler } = await import('../api/game.js');
const { _resetCircuit, redisGet } = await import('../api/_lib/redis.js');

export { handler, _resetCircuit, redisGet };

// ---------------------------------------------------------------------------
// Helpers to simulate Vercel req/res
// ---------------------------------------------------------------------------

export function makeReq({ method = 'POST', query = {}, body = {}, headers = {} } = {}) {
  return { method, query, body, headers, socket: { remoteAddress: '127.0.0.1' } };
}

export function makeRes() {
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

export async function call(action, body = {}, method = 'POST') {
  const playerName = body.playerName || body.hostName;
  const roomId = body.roomId;

  // Auto-inject stored room session token
  if (roomId && playerName && tokens[`${roomId}:${playerName}`] && !body.sessionToken) {
    body = { ...body, sessionToken: tokens[`${roomId}:${playerName}`] };
  }

  // Auto-inject stored player session token
  if (body.playerId && tokens[`player:${body.playerId}`] && !body.playerSessionToken) {
    body = { ...body, playerSessionToken: tokens[`player:${body.playerId}`] };
  }

  const req = makeReq({ method, query: { action }, body });
  const res = makeRes();
  await handler(req, res);

  // Auto-capture session tokens
  if (res._body?.sessionToken) {
    const retRoomId = body.roomId || res._body.roomId;
    const retPlayerName = body.playerName || body.hostName;
    if (retRoomId && retPlayerName) {
      tokens[`${retRoomId}:${retPlayerName}`] = res._body.sessionToken;
    }
    // Room session also serves as player session when playerId is provided
    if (body.playerId) {
      tokens[`player:${body.playerId}`] = res._body.sessionToken;
    }
  }

  // Auto-capture player session tokens from createProfile
  if (res._body?.playerSessionToken && body.playerId) {
    tokens[`player:${body.playerId}`] = res._body.playerSessionToken;
  }

  return { status: res._status, body: res._body };
}

/**
 * Ensure a player has a session token by calling createProfile.
 * Returns the player session token.
 */
export async function ensurePlayerSession(playerId, playerName = 'TestUser') {
  if (tokens[`player:${playerId}`]) return tokens[`player:${playerId}`];
  await call('createProfile', { playerId, playerName });
  return tokens[`player:${playerId}`];
}

// ---------------------------------------------------------------------------
// Room setup helper — drive the game to a desired phase
// ---------------------------------------------------------------------------

export async function setupRoom(phase) {
  const { body } = await call('createRoom', { hostName: 'Host' });
  const roomId = body.roomId;
  await call('joinRoom', { roomId, playerName: 'Player2' });
  await call('startGame', { roomId, hostName: 'Host' });

  if (phase === 'submitting') return roomId;

  await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Joke A' });
  await call('submitPunchline', { roomId, playerName: 'Player2', punchline: 'Joke B' });

  if (phase === 'betting') {
    await call('advancePhase', { roomId, hostName: 'Host' });
    return roomId;
  }

  if (phase === 'voting') {
    // Force into voting phase by manipulating store directly
    const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
    if (key) {
      const room = JSON.parse(store[key]);
      room.status = 'voting';
      room.curatedIds = [1, 2];
      room.audienceVotes = {};
      room.phaseEndsAt = Date.now() + 20000;
      store[key] = JSON.stringify(room);
    }
    return roomId;
  }

  if (phase === 'roundResults') {
    await call('advancePhase', { roomId, hostName: 'Host' }); // -> betting
    await call('advancePhase', { roomId, hostName: 'Host' }); // -> judging -> roundResults
    return roomId;
  }

  return roomId;
}
