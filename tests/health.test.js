/**
 * Tests for the /api/health endpoint.
 *
 * Verifies that the health check correctly reports healthy, degraded, and
 * unhealthy states based on Redis and GenLayer connectivity.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock node:crypto (required by genlayer.js Ed25519 path)
// ---------------------------------------------------------------------------
vi.mock('node:crypto', () => ({
    createPublicKey: () => ({}),
    verify: () => true,
}));

// ---------------------------------------------------------------------------
// Mock GenLayer SDK (dynamic import inside getGenLayerClient)
// ---------------------------------------------------------------------------
vi.mock('genlayer-js', () => ({
    createClient: () => ({
        writeContract: vi.fn(async () => '0xmocktxhash'),
        readContract: vi.fn(async () => null),
        waitForTransactionReceipt: vi.fn(async () => ({ data: { winner_id: 1 } })),
    }),
    createAccount: () => ({ address: '0xmockaddress' }),
}));

vi.mock('genlayer-js/chains', () => ({
    testnetBradbury: { id: 'bradbury-test' },
}));

// ---------------------------------------------------------------------------
// Fetch control flag — governs Upstash /ping responses
// ---------------------------------------------------------------------------
let _redisPingOk = true;

function installFetchMock() {
    globalThis.fetch = vi.fn(async (url) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/ping')) {
            return { ok: _redisPingOk };
        }
        return { ok: false, json: async () => ({ error: 'unmocked' }) };
    });
}

// ---------------------------------------------------------------------------
// Helpers — same makeReq/makeRes pattern as other test files
// ---------------------------------------------------------------------------

function makeReq({ method = 'GET' } = {}) {
    return { method };
}

function makeRes() {
    const res = {
        _status: 200,
        _body: null,
        _headers: {},
        setHeader(key, val) { res._headers[key] = val; return res; },
        status(code) { res._status = code; return res; },
        json(data) { res._body = data; return res; },
    };
    return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Health Check Endpoint', () => {
    /** @type {Function} */
    let handler;

    beforeEach(async () => {
        // Reset module registry so each test gets a fresh genlayer singleton
        // and fresh env-var reads at module top level.
        vi.resetModules();

        // Default control state
        _redisPingOk = true;

        // Ensure env vars are set for the default (healthy) case.
        // Individual tests override these BEFORE the dynamic import.
        process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
        process.env.GENLAYER_CONTRACT_ADDRESS = '0x1cC5414444E1154B84591f6C6E27959A8EDF4014';
        process.env.GENLAYER_PRIVATE_KEY = '0xfake_private_key_for_testing_only';

        installFetchMock();
    });

    // -- Healthy: redis OK + genlayer OK ----------------------------------------

    it('returns 200 healthy when redis and genlayer are both up', async () => {
        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('healthy');
        expect(res._body.checks.redis).toBe(true);
        expect(res._body.checks.genlayer).toBe(true);
        expect(res._body.checks).toHaveProperty('genlayerCircuit');
        expect(res._body.timestamp).toBeDefined();
        expect(res._body.metrics).toBeDefined();
    });

    // -- Degraded: redis OK + genlayer down ------------------------------------

    it('returns 503 degraded when redis succeeds but genlayer fails', async () => {
        // Remove GenLayer env vars so getGenLayerClient() throws on init
        delete process.env.GENLAYER_PRIVATE_KEY;
        delete process.env.GENLAYER_CONTRACT_ADDRESS;

        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(503);
        expect(res._body.status).toBe('degraded');
        expect(res._body.checks.redis).toBe(true);
        expect(res._body.checks.genlayer).toBe(false);

        // Restore for subsequent tests
        process.env.GENLAYER_CONTRACT_ADDRESS = '0x1cC5414444E1154B84591f6C6E27959A8EDF4014';
        process.env.GENLAYER_PRIVATE_KEY = '0xfake_private_key_for_testing_only';
    });

    // -- Unhealthy: redis down -------------------------------------------------

    it('returns 503 unhealthy when redis fails', async () => {
        _redisPingOk = false;
        installFetchMock();

        // Also remove GenLayer so both fail (redis down = unhealthy regardless)
        delete process.env.GENLAYER_PRIVATE_KEY;
        delete process.env.GENLAYER_CONTRACT_ADDRESS;

        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(503);
        expect(res._body.status).toBe('unhealthy');
        expect(res._body.checks.redis).toBe(false);
        expect(res._body.checks.genlayer).toBe(false);

        // Restore
        process.env.GENLAYER_CONTRACT_ADDRESS = '0x1cC5414444E1154B84591f6C6E27959A8EDF4014';
        process.env.GENLAYER_PRIVATE_KEY = '0xfake_private_key_for_testing_only';
    });

    // -- Unhealthy (redis down, genlayer up) ------------------------------------

    it('returns unhealthy when redis fails even if genlayer is up', async () => {
        _redisPingOk = false;
        installFetchMock();

        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(503);
        expect(res._body.status).toBe('unhealthy');
        expect(res._body.checks.redis).toBe(false);
        // genlayer may be true (client inits fine), but overall status is still unhealthy
        expect(res._body.checks.genlayer).toBe(true);
    });

    // -- Response shape --------------------------------------------------------

    it('includes checks object with redis, genlayer, and genlayerCircuit fields', async () => {
        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        const { checks } = res._body;
        expect(checks).toHaveProperty('redis');
        expect(checks).toHaveProperty('genlayer');
        expect(checks).toHaveProperty('genlayerCircuit');
        expect(typeof checks.redis).toBe('boolean');
        expect(typeof checks.genlayer).toBe('boolean');
        expect(typeof checks.genlayerCircuit).toBe('boolean');
    });

    // -- Cache-Control header --------------------------------------------------

    it('sets Cache-Control to no-cache, no-store', async () => {
        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._headers['Cache-Control']).toBe('no-cache, no-store');
    });

    // -- Metrics included ------------------------------------------------------

    it('includes metrics with uptime, requests, and errorRate', async () => {
        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        const { metrics } = res._body;
        expect(metrics).toBeDefined();
        expect(metrics).toHaveProperty('uptime');
        expect(metrics).toHaveProperty('requests');
        expect(metrics).toHaveProperty('errorRate');
    });

    // -- Redis missing env vars ------------------------------------------------

    it('returns redis false when Upstash env vars are missing', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._body.checks.redis).toBe(false);
        expect(res._body.status).toBe('unhealthy');

        // Restore
        process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
    });

    // -- GenLayer circuit breaker reflected -------------------------------------

    it('reflects genlayerCircuit as true when circuit breaker is closed', async () => {
        const { default: h } = await import('../api/health.js');
        handler = h;

        const req = makeReq();
        const res = makeRes();
        await handler(req, res);

        expect(res._body.checks.genlayerCircuit).toBe(true);
    });
});
