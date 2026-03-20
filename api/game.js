// Oracle of Wit API — Powered by GenLayer Intelligent Contracts

import { redisGet, redisSet, redisKeys, redisSAdd, redisSRem, redisSetNX, redisDel } from './_lib/redis.js';
import { getCorsOrigin, validateSession, validatePlayerSession, checkRateLimit } from './_lib/auth.js';
import { checkAutoAdvance, acquireAdvanceLock, releaseAdvanceLock } from './_lib/game-logic.js';
import { getLeaderboard as getLeaderboardFromStore, setLeaderboard as setLeaderboardToStore, updateLeaderboard } from './_lib/profiles.js';
import { handlers } from './_handlers/index.js';
import { logger } from './_lib/logger.js';
import { trackRequest } from './_lib/monitor.js';

/** @type {string|undefined} */
const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;

/** @type {string[]} */
const VALID_CATEGORIES = ['tech', 'crypto', 'general'];

/**
 * Strip control characters and trim user input.
 * @param {string} str
 * @returns {string}
 */
function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    // Strip control chars except newline, trim
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x09\x0B-\x1F]/g, '').trim();
}

// --- Room storage helpers ---

/**
 * Get a room directly from Redis without auto-advance check.
 * @param {string} roomId
 * @returns {Promise<import('./_lib/types.js').Room|null>}
 */
async function getRoomRaw(roomId) {
    let room = await redisGet(`room:${roomId}`);
    if (!room) return null;
    if (room.version === undefined) room.version = 0;
    return room;
}

/**
 * Get a room from Redis, auto-advancing phase if timer expired.
 * @param {string} roomId
 * @returns {Promise<import('./_lib/types.js').Room|null>}
 */
async function getRoom(roomId) {
    let room = await getRoomRaw(roomId);
    if (!room) return null;

    // Distributed lock for auto-advance
    const locked = await acquireAdvanceLock(roomId);
    if (locked) {
        try {
            room = await checkAutoAdvance(room, setRoom);
        } catch (e) {
            // Auto-advance failed (AI timeout, GenLayer error, etc.)
            // Return the room as-is so the client doesn't see "room expired"
            logger.error('Auto-advance failed, returning stale room', { service: 'storage', roomId, error: e.message });
        } finally {
            await releaseAdvanceLock(roomId);
        }
    }
    return room;
}

/**
 * Persist a room to Redis.
 * @param {string} roomId
 * @param {import('./_lib/types.js').Room} room
 * @returns {Promise<boolean>}
 */
async function setRoom(roomId, room) {
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();

    const success = await redisSet(`room:${roomId}`, room);
    if (!success) {
        logger.error('Failed to write room to Redis', { service: 'storage', roomId });
        return false;
    }

    // Keep active rooms index updated
    if (room.status === 'finished') {
        await redisSRem('active_rooms', roomId);
    } else {
        await redisSAdd('active_rooms', room.updatedAt, roomId);
    }

    return true;
}

/**
 * Get the global leaderboard.
 * @returns {Promise<import('./_lib/types.js').LeaderboardEntry[]>}
 */
async function _getLeaderboard() {
    return await getLeaderboardFromStore();
}

/**
 * Set the global leaderboard.
 * @param {import('./_lib/types.js').LeaderboardEntry[]} lb
 * @returns {Promise<void>}
 */
async function _setLeaderboard(lb) {
    return await setLeaderboardToStore(lb);
}

/**
 * Update a player's leaderboard entry.
 * @param {string} playerName
 * @param {number} score
 * @param {boolean} isBot
 * @returns {Promise<void>}
 */
async function _updateLeaderboard(playerName, score, isBot) {
    return await updateLeaderboard(playerName, score, isBot);
}

/**
 * Generate a random room code.
 * @returns {string}
 */
function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Acquire a per-room write lock (5s TTL) to serialize mutations.
 * @param {string} roomId
 * @returns {Promise<boolean>}
 */
async function acquireRoomLock(roomId) {
    return await redisSetNX(`lock:room:${roomId}`, 1, 5);
}

/**
 * Release a per-room write lock.
 * @param {string} roomId
 * @returns {Promise<void>}
 */
async function releaseRoomLock(roomId) {
    await redisDel(`lock:room:${roomId}`);
}

// Read-only actions that don't need auth tokens
const READ_ONLY_ACTIONS = new Set([
    'getRoom', 'listRooms', 'getLeaderboard', 'getWeeklyTheme', 'getProfile',
    'getDailyChallenge', 'getChallenge', 'ogPreview', 'getHallOfFame',
    'getSeasonalLeaderboard', 'getPlayerHistory', 'getSeasonArchive',
    'getPromptSubmissions', 'requestNonce'
]);

// Actions that create sessions (return tokens)
const SESSION_CREATING_ACTIONS = new Set(['createRoom', 'joinRoom']);

// Actions that require player-scoped session (non-room identity)
const PLAYER_SESSION_ACTIONS = new Set([
    'submitDailyChallenge', 'submitPrompt', 'votePrompt', 'appealVerdict'
]);

// Actions that require session validation
const SESSION_REQUIRED_ACTIONS = new Set([
    'startGame', 'submitPunchline', 'placeBet', 'castVote', 'advancePhase',
    'nextRound', 'sendReaction', 'appealVerdict'
]);

/**
 * Main API handler — routes actions to handler functions with shared context.
 * @param {Object} req - HTTP request object.
 * @param {Object} res - HTTP response object.
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    const origin = req.headers?.origin || '';
    res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(origin));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const startTime = Date.now();
    const body = req.body || {};

    // Rate limiting (per-action granularity)
    const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const allowed = await checkRateLimit(ip, action);
    if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });

    // Session validation for mutating actions
    if (SESSION_REQUIRED_ACTIONS.has(action)) {
        const { roomId, sessionToken } = body;
        const playerName = body.playerName || body.hostName;
        if (!roomId || !playerName) {
            return res.status(401).json({ error: 'roomId and playerName/hostName required' });
        }
        const valid = await validateSession(roomId, playerName, sessionToken);
        if (!valid) return res.status(401).json({ error: 'Invalid or missing session token' });
    }

    // Player session validation for identity-dependent actions
    if (PLAYER_SESSION_ACTIONS.has(action)) {
        const { playerId, playerSessionToken } = body;
        if (playerId && playerSessionToken) {
            const valid = await validatePlayerSession(playerId, playerSessionToken);
            if (!valid) return res.status(401).json({ error: 'Invalid player session' });
        } else if (playerId) {
            // playerId provided without session token — reject
            return res.status(401).json({ error: 'playerSessionToken required' });
        }
    }

    // Look up the handler for this action
    const actionHandler = handlers[action];
    if (!actionHandler) {
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Build shared context for handlers
    const context = {
        getRoomRaw,
        getRoom,
        setRoom,
        acquireRoomLock,
        releaseRoomLock,
        getLeaderboard: _getLeaderboard,
        setLeaderboard: _setLeaderboard,
        updateLeaderboard: _updateLeaderboard,
        sanitizeInput,
        generateRoomCode,
        VALID_CATEGORIES,
        GENLAYER_CONTRACT_ADDRESS,
        query: req.query,
    };

    try {
        const result = await actionHandler(body, context);
        const duration = Date.now() - startTime;
        trackRequest(action, duration, result.status);

        // Special case: ogPreview returns raw HTML
        if (result.html) {
            res.setHeader('Content-Type', 'text/html');
            return res.status(result.status).send(result.html);
        }

        return res.status(result.status).json(result.data);
    } catch (error) {
        const duration = Date.now() - startTime;
        trackRequest(action, duration, 500, error.message);
        logger.error('Unhandled API error', { service: 'api', action, roomId: body.roomId || undefined, error: String(error.message).slice(0, 200) });
        return res.status(500).json({ error: 'Internal server error' });
    }
}
