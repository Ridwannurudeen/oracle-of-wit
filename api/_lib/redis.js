// Redis helpers for Upstash REST API

import { logger } from './logger.js';

/** @type {string|undefined} */
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
/** @type {string|undefined} */
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Circuit breaker: skip retries when Redis is known-down
/** @type {boolean} */
let _circuitOpen = false;
/** @type {number} */
let _circuitOpenedAt = 0;
// 15s reset balances between detecting real outages and recovering quickly.
// Too short = hammering a failing service. Too long = slow recovery.
/** @type {number} */
const CIRCUIT_RESET_MS = 15000; // Try again after 15s

/**
 * Check if the circuit breaker is currently open.
 * @returns {boolean}
 */
function isCircuitOpen() {
    if (!_circuitOpen) return false;
    if (Date.now() - _circuitOpenedAt > CIRCUIT_RESET_MS) {
        _circuitOpen = false; // Half-open: allow one attempt
        return false;
    }
    return true;
}

/**
 * Trip the circuit breaker after a failure.
 * @returns {void}
 */
function tripCircuit() {
    _circuitOpen = true;
    _circuitOpenedAt = Date.now();
    logger.warn('Circuit breaker open, skipping retries for 15s', { service: 'redis' });
}

/**
 * Close the circuit breaker after a successful request.
 * @returns {void}
 */
function closeCircuit() {
    if (_circuitOpen) {
        _circuitOpen = false;
        logger.info('Circuit breaker closed, connection restored', { service: 'redis' });
    }
}

// Exported for testing
/** @returns {import('./types.js').CircuitState} */
export function _getCircuitState() { return { open: _circuitOpen, openedAt: _circuitOpenedAt }; }
/** @returns {void} */
export function _resetCircuit() { _circuitOpen = false; _circuitOpenedAt = 0; }

/**
 * Retry a function with exponential backoff and circuit breaker.
 * @template T
 * @param {function(): Promise<T>} fn
 * @param {number} [retries=2]
 * @param {number} [delayMs=500]
 * @returns {Promise<T>}
 */
async function withRetry(fn, retries = 2, delayMs = 500) {
    if (isCircuitOpen()) {
        logger.warn('Circuit open, fast-failing', { service: 'redis' });
        throw new Error('Redis circuit breaker open');
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await fn();
            closeCircuit(); // Success — close circuit if half-open
            return result;
        } catch (e) {
            if (attempt >= retries || !(e instanceof TypeError || e.message?.includes('fetch'))) {
                tripCircuit();
                throw e;
            }
            logger.warn(`Retry ${attempt + 1}/${retries}`, { service: 'redis', delayMs: delayMs * (attempt + 1) });
            await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        }
    }
}

/**
 * Check if Redis is reachable.
 * @returns {Promise<boolean>}
 */
export async function redisHealthCheck() {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/ping`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        return res.ok;
    } catch (e) { return false; }
}

/**
 * Get a value from Redis by key.
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function redisGet(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) { logger.warn('No credentials configured', { service: 'redis' }); return null; }
    return withRetry(async () => {
        const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        if (!res.ok) { logger.warn('GET failed', { service: 'redis', key, status: res.status }); return null; }
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
    }).catch(e => { logger.warn('GET error', { service: 'redis', key, error: e.message }); return null; });
}

/**
 * Set a value in Redis with an expiration.
 * @param {string} key
 * @param {any} value
 * @param {number} [exSeconds=7200]
 * @returns {Promise<boolean>}
 */
export async function redisSet(key, value, exSeconds = 7200) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) { logger.warn('No credentials configured', { service: 'redis' }); return false; }
    return withRetry(async () => {
        const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}?EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(value)
        });
        if (!res.ok) {
            const text = await res.text();
            logger.warn('SET failed', { service: 'redis', key, status: res.status, detail: text });
            return false;
        }
        const data = await res.json();
        if (data.error) { logger.warn('SET Upstash error', { service: 'redis', key, error: data.error }); return false; }
        return true;
    }).catch(e => { logger.warn('SET error', { service: 'redis', key, error: e.message }); return false; });
}

/**
 * Get all keys matching a pattern from Redis.
 * @param {string} pattern
 * @returns {Promise<string[]>}
 */
export async function redisKeys(pattern) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
    try {
        const res = await fetch(`${UPSTASH_URL}/keys/${encodeURIComponent(pattern)}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || [];
    } catch (e) { return []; }
}

/**
 * Increment a key in Redis atomically.
 * @param {string} key
 * @returns {Promise<number>}
 */
export async function redisIncr(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0;
    try {
        const res = await fetch(`${UPSTASH_URL}/incr/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || 0;
    } catch (e) { return 0; }
}

/**
 * Set an expiration on a Redis key.
 * @param {string} key
 * @param {number} seconds
 * @returns {Promise<boolean>}
 */
export async function redisExpire(key, seconds) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(key)}/${seconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result === 1;
    } catch (e) { return false; }
}

/**
 * Set a key in Redis only if it does not already exist (atomic lock).
 * @param {string} key
 * @param {any} value
 * @param {number} exSeconds
 * @returns {Promise<boolean>}
 */
export async function redisSetNX(key, value, exSeconds) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    return withRetry(async () => {
        const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${JSON.stringify(value)}?NX&EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result === 'OK';
    }).catch(() => false);
}

/**
 * Delete a key from Redis.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function redisDel(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result >= 1;
    } catch (e) { return false; }
}

/**
 * Add a member to a Redis sorted set.
 * @param {string} key
 * @param {number} score
 * @param {string} member
 * @returns {Promise<boolean>}
 */
export async function redisSAdd(key, score, member) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/zadd/${encodeURIComponent(key)}/${score}/${encodeURIComponent(member)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result !== null;
    } catch (_e) { return false; }
}

/**
 * Remove a member from a Redis sorted set.
 * @param {string} key
 * @param {string} member
 * @returns {Promise<boolean>}
 */
export async function redisSRem(key, member) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/zrem/${encodeURIComponent(key)}/${encodeURIComponent(member)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result >= 1;
    } catch (_e) { return false; }
}

/**
 * Get members of a sorted set ordered by score (descending), with pagination.
 * @param {string} key
 * @param {number} start
 * @param {number} stop
 * @returns {Promise<string[]>}
 */
export async function redisSRange(key, start, stop) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
    try {
        const res = await fetch(`${UPSTASH_URL}/zrevrange/${encodeURIComponent(key)}/${start}/${stop}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || [];
    } catch (_e) { return []; }
}
