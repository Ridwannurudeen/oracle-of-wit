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

const SESSION_TTL = parseInt(process.env.SESSION_TTL) || 7200;

export async function storeSessionToken(roomId, playerName, token) {
    await redisSet(`session:${roomId}:${playerName}`, token, SESSION_TTL);
}

export async function validateSession(roomId, playerName, token) {
    if (!token) return false;
    const stored = await redisGet(`session:${roomId}:${playerName}`);
    return stored === token;
}

export async function checkRateLimit(ip) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:${ip}:${minute}`;
    const count = await redisIncr(key);
    if (count === 1) await redisExpire(key, 60);
    const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 60;
    return count <= RATE_LIMIT_PER_MINUTE;
}
