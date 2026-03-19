// Authentication, session tokens, CORS, and rate limiting

import crypto from 'crypto';
import { redisSet, redisGet, redisIncr, redisExpire } from './redis.js';

export const ALLOWED_ORIGINS = [
    'https://oracle-of-wit.vercel.app',
    'http://localhost:3000'
];

export function getCorsOrigin(reqOrigin) {
    if (ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
    return ALLOWED_ORIGINS[0]; // default to production
}

export function generateToken() {
    return crypto.randomUUID();
}

const SESSION_TTL = Math.max(60, parseInt(process.env.SESSION_TTL) || 7200);

export async function storeSessionToken(roomId, playerName, token) {
    await redisSet(`session:${roomId}:${playerName}`, token, SESSION_TTL);
}

export async function validateSession(roomId, playerName, token) {
    if (!token) return false;
    const stored = await redisGet(`session:${roomId}:${playerName}`);
    return stored === token;
}

// Per-action rate limit tiers: mutating actions get stricter limits
const MUTATING_ACTIONS = new Set([
    'createRoom', 'joinRoom', 'startGame', 'submitPunchline',
    'placeBet', 'castVote', 'advancePhase', 'nextRound',
    'sendReaction', 'appealVerdict', 'submitDailyChallenge',
    'createChallenge', 'submitPrompt', 'votePrompt', 'createProfile', 'createShare'
]);

export async function checkRateLimit(ip, action) {
    const minute = Math.floor(Date.now() / 60000);
    const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 60;

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
