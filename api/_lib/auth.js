// Authentication, session tokens, CORS, and rate limiting

import crypto from 'crypto';
import { redisSet, redisGet, redisIncr, redisExpire } from './redis.js';

/** @type {string[]} */
export const ALLOWED_ORIGINS = [
    'https://oracle-of-wit.vercel.app',
    'http://localhost:3000'
];

/**
 * Get the CORS origin to use in the response header.
 * @param {string} reqOrigin - The Origin header from the request.
 * @returns {string}
 */
export function getCorsOrigin(reqOrigin) {
    if (ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
    return ALLOWED_ORIGINS[0]; // default to production
}

/**
 * Generate a cryptographically secure session token.
 * @returns {string}
 */
export function generateToken() {
    return crypto.randomUUID();
}

const SESSION_TTL = Math.max(60, parseInt(process.env.SESSION_TTL) || 7200);

/**
 * Store a session token in Redis.
 * @param {string} roomId
 * @param {string} playerName
 * @param {string} token
 * @returns {Promise<void>}
 */
export async function storeSessionToken(roomId, playerName, token) {
    await redisSet(`session:${roomId}:${playerName}`, token, SESSION_TTL);
}

/**
 * Validate a session token against stored value.
 * @param {string} roomId
 * @param {string} playerName
 * @param {string|undefined} token
 * @returns {Promise<boolean>}
 */
export async function validateSession(roomId, playerName, token) {
    if (!token) return false;
    const stored = await redisGet(`session:${roomId}:${playerName}`);
    return stored === token;
}

/**
 * Store a player-scoped session token in Redis.
 * @param {string} playerId
 * @param {string} token
 * @returns {Promise<void>}
 */
export async function storePlayerSession(playerId, token) {
    await redisSet(`session:player:${playerId}`, token, SESSION_TTL);
}

/**
 * Validate a player-scoped session token.
 * @param {string} playerId
 * @param {string|undefined} token
 * @returns {Promise<boolean>}
 */
export async function validatePlayerSession(playerId, token) {
    if (!token || !playerId) return false;
    const stored = await redisGet(`session:player:${playerId}`);
    return stored === token;
}

// Per-action rate limit tiers: mutating actions get stricter limits
const MUTATING_ACTIONS = new Set([
    'createRoom', 'joinRoom', 'startGame', 'submitPunchline',
    'placeBet', 'castVote', 'advancePhase', 'nextRound',
    'sendReaction', 'appealVerdict', 'submitDailyChallenge',
    'createChallenge', 'submitPrompt', 'votePrompt', 'createProfile', 'createShare'
]);

/**
 * Check if a request is within rate limits.
 * @param {string} ip - The client IP address.
 * @param {string} action - The API action being performed.
 * @returns {Promise<boolean>} True if allowed, false if rate-limited.
 */
export async function checkRateLimit(ip, action) {
    const minute = Math.floor(Date.now() / 60000);
    const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 120;

    // Global rate limit
    const globalKey = `rl:${ip}:${minute}`;
    const globalCount = await redisIncr(globalKey);
    if (globalCount === 1) await redisExpire(globalKey, 60);
    if (globalCount > RATE_LIMIT_PER_MINUTE) return false;

    // Stricter limit for mutating actions (20/min)
    if (MUTATING_ACTIONS.has(action)) {
        const mutateKey = `rl:m:${ip}:${minute}`;
        const mutateCount = await redisIncr(mutateKey);
        if (mutateCount === 1) await redisExpire(mutateKey, 60);
        if (mutateCount > 20) return false;
    }

    return true;
}
