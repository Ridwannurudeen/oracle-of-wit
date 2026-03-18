/**
 * Tests for Oracle of Wit Discord bot (Interactions API).
 *
 * Mocks discord-interactions verifyKey, Upstash Redis, and GenLayer SDK
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

// ---------------------------------------------------------------------------
// Mock node:crypto for Ed25519 verification (must come before handler import)
// ---------------------------------------------------------------------------
let _verifyResult = true;

vi.mock('node:crypto', () => ({
    createPublicKey: () => ({}),
    verify: () => _verifyResult,
}));

// Mock fetch globally — Upstash REST + GenLayer
globalThis.fetch = vi.fn(async (url, opts) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Upstash GET
    if (urlStr.includes('/get/')) {
        const key = urlStr.split('/get/')[1];
        const val = store[key];
        return { ok: true, json: async () => ({ result: val ? JSON.stringify(val) : null }) };
    }
    // Upstash SET
    if (urlStr.includes('/set/')) {
        const key = urlStr.split('/set/')[1].split('?')[0];
        const value = JSON.parse(opts.body);
        store[key] = value;
        return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    // Upstash KEYS
    if (urlStr.includes('/keys/')) {
        const pattern = urlStr.split('/keys/')[1];
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        const keys = Object.keys(store).filter(k => regex.test(k));
        return { ok: true, json: async () => ({ result: keys }) };
    }

    return { ok: false, json: async () => ({ error: 'unmocked' }) };
});

// Stub env vars
process.env.DISCORD_PUBLIC_KEY = 'fake-public-key';
process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

const { default: handler } = await import('../api/discord.js');

// ---------------------------------------------------------------------------
// Helpers to simulate Vercel req/res with raw body streaming
// ---------------------------------------------------------------------------

function makeReq({ method = 'POST', body = {}, headers = {} } = {}) {
    const defaultHeaders = {
        'x-signature-ed25519': 'fake-sig',
        'x-signature-timestamp': '12345',
        ...headers,
    };
    return {
        method,
        body,
        headers: defaultHeaders,
    };
}

function makeRes() {
    const res = {
        _status: 200,
        _body: null,
        status(code) { res._status = code; return res; },
        json(data) { res._body = data; return res; },
    };
    return res;
}

async function call(body, { method, headers } = {}) {
    const req = makeReq({ method, body, headers });
    const res = makeRes();
    await handler(req, res);
    return { status: res._status, body: res._body };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Discord Bot Handler', () => {
    beforeEach(() => {
        resetStore();
        _verifyResult = true;
    });

    // -- Signature verification ------------------------------------------------

    it('returns 401 for invalid signature', async () => {
        _verifyResult = false;
        const { status, body } = await call({ type: 1 });
        expect(status).toBe(401);
        expect(body.error).toMatch(/signature/i);
    });

    // -- Method enforcement ----------------------------------------------------

    it('returns 405 for non-POST requests', async () => {
        const { status, body } = await call({ type: 1 }, { method: 'GET' });
        expect(status).toBe(405);
        expect(body.error).toMatch(/method/i);
    });

    // -- PING / PONG -----------------------------------------------------------

    it('responds PONG to PING', async () => {
        const { status, body } = await call({ type: 1 });
        expect(status).toBe(200);
        expect(body.type).toBe(1);
    });

    // -- /play -----------------------------------------------------------------

    describe('/play', () => {
        it('creates a room with default category', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'play' },
            });
            expect(status).toBe(200);
            expect(body.type).toBe(4);
            expect(body.data.embeds[0].title).toMatch(/Game Room/i);
            expect(body.data.embeds[0].description).toContain('tech');
        });

        it('creates a room with specified category', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'play', options: [{ name: 'category', value: 'crypto' }] },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].description).toContain('crypto');
        });
    });

    // -- /leaderboard ----------------------------------------------------------

    describe('/leaderboard', () => {
        it('shows empty leaderboard message', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'leaderboard' },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].description).toMatch(/no players/i);
        });

        it('shows ranked players when data exists', async () => {
            store['leaderboard'] = [
                { name: 'Alice', totalScore: 500, gamesPlayed: 10, wins: 5 },
                { name: 'Bob', totalScore: 300, gamesPlayed: 8, wins: 3 },
            ];
            const { status, body } = await call({
                type: 2,
                data: { name: 'leaderboard' },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].description).toContain('Alice');
            expect(body.data.embeds[0].description).toContain('Bob');
        });
    });

    // -- /stats ----------------------------------------------------------------

    describe('/stats', () => {
        it('shows global stats', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'stats' },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].title).toMatch(/global/i);
        });

        it('shows player stats when found', async () => {
            store['leaderboard'] = [
                { name: 'Alice', totalScore: 500, gamesPlayed: 10, wins: 5 },
            ];
            const { status, body } = await call({
                type: 2,
                data: { name: 'stats', options: [{ name: 'player', value: 'Alice' }] },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].title).toContain('Alice');
            expect(body.data.embeds[0].fields).toBeDefined();
        });

        it('shows not-found for unknown player', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'stats', options: [{ name: 'player', value: 'Nobody' }] },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].description).toMatch(/not found/i);
        });
    });

    // -- /joke -----------------------------------------------------------------

    describe('/joke', () => {
        it('returns an ephemeral joke setup', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'joke' },
            });
            expect(status).toBe(200);
            expect(body.data.flags).toBe(64);
            expect(body.data.content).toMatch(/Joke Setup/i);
        });

        it('respects category option', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'joke', options: [{ name: 'category', value: 'crypto' }] },
            });
            expect(status).toBe(200);
            expect(body.data.content).toContain('crypto');
        });
    });

    // -- /history --------------------------------------------------------------

    describe('/history', () => {
        it('shows Redis fallback when GenLayer unavailable', async () => {
            store['leaderboard'] = [
                { name: 'Alice', totalScore: 500, gamesPlayed: 10 },
            ];
            const { status, body } = await call({
                type: 2,
                data: { name: 'history', options: [{ name: 'player', value: 'Alice' }] },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].title).toContain('Alice');
        });

        it('shows not-found for unknown player', async () => {
            const { status, body } = await call({
                type: 2,
                data: { name: 'history', options: [{ name: 'player', value: 'Ghost' }] },
            });
            expect(status).toBe(200);
            expect(body.data.embeds[0].description).toMatch(/not found/i);
        });
    });

    // -- Unknown command -------------------------------------------------------

    it('handles unknown command gracefully', async () => {
        const { status, body } = await call({
            type: 2,
            data: { name: 'nonexistent' },
        });
        expect(status).toBe(200);
        expect(body.data.content).toMatch(/unknown/i);
    });

    // -- Unknown interaction type ----------------------------------------------

    it('returns 400 for unknown interaction type', async () => {
        const { status, body } = await call({ type: 99 });
        expect(status).toBe(400);
        expect(body.error).toMatch(/unknown/i);
    });
});
