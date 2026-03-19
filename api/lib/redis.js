// Redis helpers for Upstash REST API

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Circuit breaker: skip retries when Redis is known-down
let _circuitOpen = false;
let _circuitOpenedAt = 0;
const CIRCUIT_RESET_MS = 15000; // Try again after 15s

function isCircuitOpen() {
    if (!_circuitOpen) return false;
    if (Date.now() - _circuitOpenedAt > CIRCUIT_RESET_MS) {
        _circuitOpen = false; // Half-open: allow one attempt
        return false;
    }
    return true;
}

function tripCircuit() {
    _circuitOpen = true;
    _circuitOpenedAt = Date.now();
    console.warn('[Redis] Circuit breaker OPEN — skipping retries for 15s');
}

function closeCircuit() {
    if (_circuitOpen) {
        _circuitOpen = false;
        console.log('[Redis] Circuit breaker CLOSED — connection restored');
    }
}

// Exported for testing
export function _getCircuitState() { return { open: _circuitOpen, openedAt: _circuitOpenedAt }; }
export function _resetCircuit() { _circuitOpen = false; _circuitOpenedAt = 0; }

async function withRetry(fn, retries = 2, delayMs = 500) {
    if (isCircuitOpen()) {
        console.warn('[Redis] Circuit open, fast-failing');
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
            console.warn(`[Redis] Retry ${attempt + 1}/${retries} after ${delayMs}ms`);
            await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        }
    }
}

export async function redisHealthCheck() {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/ping`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        return res.ok;
    } catch (e) { return false; }
}

export async function redisGet(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) { console.warn('[Redis] No credentials configured'); return null; }
    return withRetry(async () => {
        const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        if (!res.ok) { console.warn(`[Redis] GET key=${key} failed: ${res.status} ${res.statusText}`); return null; }
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
    }).catch(e => { console.warn(`[Redis] GET key=${key} error:`, e.message); return null; });
}

export async function redisSet(key, value, exSeconds = 7200) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) { console.warn('[Redis] No credentials configured'); return false; }
    return withRetry(async () => {
        const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}?EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(value)
        });
        if (!res.ok) {
            const text = await res.text();
            console.warn(`[Redis] SET key=${key} failed: ${res.status} ${res.statusText} — ${text}`);
            return false;
        }
        const data = await res.json();
        if (data.error) { console.warn(`[Redis] SET key=${key} Upstash error:`, data.error); return false; }
        return true;
    }).catch(e => { console.warn(`[Redis] SET key=${key} error:`, e.message); return false; });
}

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
