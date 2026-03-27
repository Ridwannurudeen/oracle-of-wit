// Room management handlers: createRoom, joinRoom, getRoom, listRooms

import { redisKeys, redisSRange } from '../_lib/redis.js';
import { generateToken, storeSessionToken, storePlayerSession } from '../_lib/auth.js';
import { BOT_NAMES, getCurrentTheme } from '../_lib/constants.js';
import { createGameOnChain } from '../_lib/genlayer.js';
/**
 * Create a new game room.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function createRoom(body, ctx) {
    const { category, maxPlayers = 100, singlePlayer = false } = body;
    const hostName = ctx.sanitizeInput(body.hostName);
    if (!hostName) return { status: 400, data: { error: 'hostName required' } };
    if (hostName.length > 30) return { status: 400, data: { error: 'Host name too long (max 30 characters)' } };
    const safeCategory = ctx.VALID_CATEGORIES.includes(category) ? category : 'tech';
    const clampedMaxPlayers = Math.max(2, Math.min(100, Number(maxPlayers) || 100));

    const roomId = ctx.generateRoomCode();
    const players = [{ name: hostName, score: 0, isHost: true, isBot: false, joinedAt: Date.now() }];

    if (singlePlayer) {
        const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3; i++) {
            players.push({ name: shuffledBots[i], score: 0, isHost: false, isBot: true, joinedAt: Date.now() });
        }
    }

    const room = {
        id: roomId, host: hostName, category: safeCategory,
        maxPlayers: clampedMaxPlayers, players, spectators: [],
        status: 'waiting', currentRound: 0, totalRounds: 5,
        jokePrompt: '', submissions: [], bets: [], reactions: [],
        roundResults: [], usedPrompts: [],
        createdAt: Date.now(), updatedAt: Date.now(),
        phaseEndsAt: null, isSinglePlayer: singlePlayer,
        weeklyTheme: getCurrentTheme(), version: 0,
        chainTxHashes: { create: null, rounds: [], finalize: null }
    };

    // Register game on GenLayer before persisting (with 15s timeout for graceful degradation)
    const glStart = Date.now();
    try {
        const result = await Promise.race([
            createGameOnChain(roomId, hostName, safeCategory, 5, players),
            new Promise(resolve => setTimeout(() => resolve(null), 15000))
        ]);
        if (result?.txHash) {
            room.chainTxHashes.create = result.txHash;
        }
        console.log('[GenLayer] createGameOnChain:', result?.txHash ? 'OK' : 'null', 'in', Date.now() - glStart, 'ms');
    } catch (e) {
        console.error('[GenLayer] createGameOnChain error in', Date.now() - glStart, 'ms:', e.message);
    }

    await ctx.setRoom(roomId, room);

    // Generate session token
    const token = generateToken();
    await storeSessionToken(roomId, hostName, token);

    // Bind playerId to session if provided
    if (body.playerId) await storePlayerSession(body.playerId, token);

    return { status: 200, data: { success: true, roomId, room, sessionToken: token } };
}

/**
 * Join an existing game room or spectate.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function joinRoom(body, ctx) {
    const { roomId, spectator } = body;
    const playerName = ctx.sanitizeInput(body.playerName);
    if (!roomId || !playerName) return { status: 400, data: { error: 'roomId and playerName required' } };
    if (playerName.length > 30) return { status: 400, data: { error: 'Player name too long (max 30 characters)' } };

    let room = await ctx.getRoom(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found. It may have expired.' } };

    if (!room.spectators) room.spectators = [];

    if (spectator) {
        const existing = room.spectators.find(s => s.name === playerName);
        if (existing) {
            existing.joinedAt = Date.now();
        } else {
            if (room.spectators.length >= 50) return { status: 400, data: { error: 'Spectator limit reached' } };
            room.spectators.push({ name: playerName, joinedAt: Date.now() });
        }
        room.updatedAt = Date.now();
        await ctx.setRoom(roomId, room);
        return { status: 200, data: { success: true, room, spectating: true } };
    }

    if (room.status !== 'waiting') return { status: 400, data: { error: 'Game already started' } };
    if (room.isSinglePlayer) return { status: 400, data: { error: 'Cannot join single-player game' } };
    if (room.players.length >= room.maxPlayers) return { status: 400, data: { error: 'Room is full' } };
    if (room.players.find(p => p.name === playerName)) return { status: 400, data: { error: 'Player already in room' } };

    room.players.push({ name: playerName, score: 0, isHost: false, isBot: false, joinedAt: Date.now() });
    room.updatedAt = Date.now();
    await ctx.setRoom(roomId, room);

    // Generate session token
    const token = generateToken();
    await storeSessionToken(roomId, playerName, token);

    // Bind playerId to session if provided
    if (body.playerId) await storePlayerSession(body.playerId, token);

    return { status: 200, data: { success: true, room, sessionToken: token } };
}

/**
 * Get the current state of a room.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function getRoom(body, ctx) {
    const roomId = ctx.query.roomId;
    if (!roomId) return { status: 400, data: { error: 'roomId required' } };
    const room = await ctx.getRoom(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };
    return { status: 200, data: { success: true, room } };
}

/**
 * List all active public rooms with pagination.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function listRooms(body, ctx) {
    const page = Math.max(1, parseInt(ctx.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(ctx.query.limit, 10) || 20));

    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    // Use sorted set for efficient paginated listing
    const roomIds = await redisSRange('active_rooms', start, stop);

    const rooms = [];
    for (const roomId of roomIds) {
        const room = await ctx.getRoomRaw(roomId);
        if (!room || room.isSinglePlayer || room.status === 'finished') continue;
        rooms.push({
            id: room.id, host: room.host, category: room.category,
            players: room.players.length, maxPlayers: room.maxPlayers,
            status: room.status, spectators: (room.spectators || []).length,
            currentRound: room.currentRound, totalRounds: room.totalRounds
        });
    }

    return { status: 200, data: { success: true, rooms, page, limit, total: rooms.length } };
}
