// Core game action handlers: startGame, submitPunchline, placeBet, castVote, advancePhase, nextRound, sendReaction

import { SUBMISSION_TIME, BETTING_TIME } from '../_lib/constants.js';
import { transitionFromSubmitting, autoJudge, addBotBets, getNextPrompt } from '../_lib/game-logic.js';
import { postGameToDiscord, finalizeGameOnChain, updatePlayerStatsOnChain } from '../_lib/genlayer.js';
import { getProfile, saveProfile, checkAchievements } from '../_lib/profiles.js';

/**
 * Start a game in the waiting room.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function startGame(body, ctx) {
    const { roomId, hostName } = body;
    let room = await ctx.getRoom(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };
    if (room.status !== 'waiting') return { status: 400, data: { error: 'Game already started' } };
    if (room.host !== hostName) return { status: 403, data: { error: 'Only host can start game' } };
    if (!room.isSinglePlayer && room.players.length < 2) return { status: 400, data: { error: 'Need at least 2 players' } };

    const now = Date.now();
    room.status = 'submitting';
    room.currentRound = 1;
    room.submissions = [];
    room.bets = [];
    room.reactions = [];
    room.jokePrompt = await getNextPrompt(room);
    room.phaseEndsAt = now + (room.submissionTime || SUBMISSION_TIME);
    room.roundStartedAt = now;
    room.updatedAt = now;
    room.betBudgets = {};
    for (const p of room.players) room.betBudgets[p.name] = 300;

    await ctx.setRoom(roomId, room);
    return { status: 200, data: { success: true, room } };
}

/**
 * Submit a punchline during the submission phase.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function submitPunchline(body, ctx) {
    const { roomId, playerName } = body;
    const punchline = ctx.sanitizeInput(body.punchline);
    if (!punchline) return { status: 400, data: { error: 'Punchline cannot be empty' } };
    if (punchline.length > 200) return { status: 400, data: { error: 'Punchline too long (max 200 characters)' } };

    const locked = await ctx.acquireRoomLock(roomId);
    if (!locked) return { status: 409, data: { error: 'Room busy, try again' } };
    try {
        let room = await ctx.getRoomRaw(roomId);
        if (!room) return { status: 404, data: { error: 'Room not found' } };
        if (!room.players.find(p => p.name === playerName)) return { status: 403, data: { error: 'Not a player in this room' } };
        if (room.status !== 'submitting') return { status: 400, data: { error: 'Not in submission phase', currentStatus: room.status } };
        if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return { status: 400, data: { error: 'Time expired' } };
        if (room.submissions.find(s => s.playerName === playerName)) return { status: 400, data: { error: 'Already submitted' } };

        room.submissions.push({ id: room.submissions.length + 1, playerName, punchline, submittedAt: Date.now() });
        room.updatedAt = Date.now();
        await ctx.setRoom(roomId, room);
        return { status: 200, data: { success: true, submissionCount: room.submissions.length, totalPlayers: room.players.length } };
    } finally {
        await ctx.releaseRoomLock(roomId);
    }
}

/**
 * Place a bet on a submission during the betting phase.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function placeBet(body, ctx) {
    const { roomId, playerName, amount } = body;
    const submissionId = parseInt(body.submissionId);
    if (!submissionId || isNaN(submissionId)) return { status: 400, data: { error: 'Invalid submission ID' } };

    const locked = await ctx.acquireRoomLock(roomId);
    if (!locked) return { status: 409, data: { error: 'Room busy, try again' } };
    try {
        let room = await ctx.getRoomRaw(roomId);
        if (!room) return { status: 404, data: { error: 'Room not found' } };
        if (room.status !== 'betting') return { status: 400, data: { error: 'Not in betting phase' } };
        if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return { status: 400, data: { error: 'Time expired' } };
        if (!room.submissions.find(s => s.id === submissionId)) return { status: 400, data: { error: 'Invalid submission' } };
        if (room.bets.find(b => b.playerName === playerName)) return { status: 400, data: { error: 'Already placed bet' } };

        if (!room.betBudgets) room.betBudgets = {};
        const budget = room.betBudgets[playerName] ?? 300;
        if (budget < 10) return { status: 400, data: { error: 'Insufficient budget (minimum bet is 10)' } };
        const betAmount = Math.max(10, Math.min(amount || 50, 100, budget));

        room.betBudgets[playerName] = budget - betAmount;
        room.bets.push({ playerName, submissionId, amount: betAmount, placedAt: Date.now() });
        room.updatedAt = Date.now();
        await ctx.setRoom(roomId, room);
        return { status: 200, data: { success: true, betCount: room.bets.length, totalPlayers: room.players.length, remainingBudget: room.betBudgets[playerName] } };
    } finally {
        await ctx.releaseRoomLock(roomId);
    }
}

/**
 * Cast a vote for a curated submission during the voting phase.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function castVote(body, ctx) {
    const { roomId, playerName } = body;
    const submissionId = parseInt(body.submissionId);
    if (!submissionId || isNaN(submissionId)) return { status: 400, data: { error: 'Invalid submission ID' } };

    const locked = await ctx.acquireRoomLock(roomId);
    if (!locked) return { status: 409, data: { error: 'Room busy, try again' } };
    try {
        let room = await ctx.getRoomRaw(roomId);
        if (!room) return { status: 404, data: { error: 'Room not found' } };
        if (room.status !== 'voting') return { status: 400, data: { error: 'Not in voting phase' } };
        if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return { status: 400, data: { error: 'Time expired' } };
        if (!room.players.find(p => p.name === playerName)) return { status: 403, data: { error: 'Not a player' } };
        if (!room.curatedIds?.includes(submissionId)) return { status: 400, data: { error: 'Not a curated submission' } };

        const sub = room.submissions.find(s => s.id === submissionId);
        if (sub?.playerName === playerName) return { status: 400, data: { error: 'Cannot vote for yourself' } };

        if (!room.audienceVotes) room.audienceVotes = {};
        if (room.audienceVotes[playerName]) return { status: 400, data: { error: 'Already voted' } };

        room.audienceVotes[playerName] = submissionId;
        room.updatedAt = Date.now();
        await ctx.setRoom(roomId, room);
        return { status: 200, data: { success: true, voteCount: Object.keys(room.audienceVotes).length, totalPlayers: room.players.length } };
    } finally {
        await ctx.releaseRoomLock(roomId);
    }
}

/**
 * Host-only: manually advance the game to the next phase.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function advancePhase(body, ctx) {
    const { roomId, hostName } = body;
    let room = await ctx.getRoomRaw(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };
    if (room.host !== hostName) return { status: 403, data: { error: 'Only host can advance' } };

    const now = Date.now();
    if (room.status === 'submitting') {
        await transitionFromSubmitting(room, ctx.setRoom);
    } else if (room.status === 'betting') {
        if (room.isSinglePlayer) {
            addBotBets(room);
            await ctx.setRoom(roomId, room);
        }
        room = await autoJudge(room, ctx.setRoom);
    }
    return { status: 200, data: { success: true, room } };
}

/**
 * Host-only: advance to the next round or finish the game.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function nextRound(body, ctx) {
    const { roomId, hostName, playerId } = body;
    let room = await ctx.getRoom(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };
    if (room.host !== hostName) return { status: 403, data: { error: 'Only host can advance' } };

    if (room.currentRound >= room.totalRounds) {
        room.status = 'finished';
        for (const p of room.players) await ctx.updateLeaderboard(p.name, p.score, p.isBot);
        postGameToDiscord(room).catch(e => console.error('[Discord] error:', e.message));

        // Finalize game on GenLayer (with 10s timeout for graceful degradation)
        const finalStandings = [...room.players].sort((a, b) => b.score - a.score);
        try {
            const result = await Promise.race([
                finalizeGameOnChain(roomId, finalStandings[0]?.name || 'Unknown', finalStandings),
                new Promise(resolve => setTimeout(() => resolve(null), 10000))
            ]);
            if (result?.txHash) {
                room.chainTxHashes = room.chainTxHashes || { create: null, rounds: [], finalize: null };
                room.chainTxHashes.finalize = result.txHash;
            }
        } catch (e) { /* graceful degradation */ }

        await ctx.setRoom(roomId, room);

        const leaderboard = await ctx.getLeaderboard();
        let profileUpdate = null;
        if (playerId) {
            try {
                let profile = await getProfile(playerId);
                if (profile) {
                    const standings = [...room.players].sort((a, b) => b.score - a.score);
                    const playerData = room.players.find(p => p.name === profile.name);
                    const isWinner = standings[0]?.name === profile.name;

                    profile.lifetimeXP += playerData?.score || 0;
                    profile.gamesPlayed++;
                    if (isWinner) profile.gamesWon++;
                    profile.lastPlayedAt = Date.now();

                    let roundsWonThisGame = 0, correctBetsThisGame = 0, hadComeback = false;
                    for (const rr of (room.roundResults || [])) {
                        if (rr.winnerName === profile.name) roundsWonThisGame++;
                        if (rr.isComeback && rr.winnerName === profile.name) hadComeback = true;
                    }
                    for (const rr of (room.roundResults || [])) {
                        if ((rr.scores?.[profile.name] || 0) > 0) {
                            const winBonus = rr.winnerName === profile.name ? 100 : 0;
                            if ((rr.scores[profile.name] || 0) > winBonus) correctBetsThisGame++;
                        }
                    }

                    profile.roundsWon += roundsWonThisGame;
                    profile.totalCorrectBets += correctBetsThisGame;
                    const currentStreak = room.streaks?.[profile.name] || 0;
                    if (currentStreak > profile.bestStreak) profile.bestStreak = currentStreak;

                    const newAchievements = checkAchievements(profile, {
                        perfectGame: roundsWonThisGame === room.totalRounds,
                        comeback: hadComeback
                    });
                    await saveProfile(profile);

                    // Update player stats on-chain (fire-and-forget, non-blocking)
                    try {
                        updatePlayerStatsOnChain(profile.name, playerData?.score || 0, isWinner)
                            .catch(e => console.error('[GenLayer] updatePlayerStatsOnChain error:', e.message));
                    } catch (e) { /* graceful degradation */ }

                    profileUpdate = { profile, newAchievements };
                }
            } catch(e) { console.error('Profile update failed:', e); }
        }

        return { status: 200, data: {
            success: true, room,
            finalStandings: [...room.players].sort((a, b) => b.score - a.score),
            leaderboard: leaderboard.slice(0, 10),
            profileUpdate
        }};
    }

    const now = Date.now();
    room.currentRound++;
    room.status = 'submitting';
    room.submissions = [];
    room.bets = [];
    room.reactions = [];
    room.curatedIds = null;
    room.audienceVotes = {};
    room.jokePrompt = await getNextPrompt(room);
    room.phaseEndsAt = now + (room.submissionTime || SUBMISSION_TIME);
    room.roundStartedAt = now;
    room.updatedAt = now;
    await ctx.setRoom(roomId, room);
    return { status: 200, data: { success: true, room } };
}

/**
 * Create a rematch room with same settings and auto-join connected players.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function rematch(body, ctx) {
    const { roomId, hostName, playerId } = body;
    let oldRoom = await ctx.getRoom(roomId);
    if (!oldRoom) return { status: 404, data: { error: 'Original room not found' } };
    if (oldRoom.host !== hostName) return { status: 403, data: { error: 'Only host can create rematch' } };
    if (oldRoom.status !== 'finished') return { status: 400, data: { error: 'Game must be finished to rematch' } };

    // Import createRoom handler and build rematch body
    const rematchBody = {
        hostName,
        category: oldRoom.category,
        maxPlayers: oldRoom.maxPlayers,
        singlePlayer: oldRoom.isSinglePlayer,
        totalRounds: oldRoom.totalRounds,
        submissionTime: oldRoom.submissionTime,
        bettingTime: oldRoom.bettingTime,
        isPrivate: oldRoom.isPrivate || false,
        isSpeedMode: oldRoom.isSpeedMode || false,
        botDifficulty: oldRoom.botDifficulty || 'easy',
        playerId,
        rematchFrom: roomId
    };

    const { createRoom: createRoomHandler } = await import('./room.js');
    return createRoomHandler(rematchBody, ctx);
}

/**
 * Send a chat message in a room (spectators only during active phases).
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function sendChat(body, ctx) {
    const { roomId, playerName, message } = body;
    if (!message || typeof message !== 'string') return { status: 400, data: { error: 'Message required' } };
    const text = message.trim().slice(0, 50);
    if (!text) return { status: 400, data: { error: 'Message cannot be empty' } };

    const locked = await ctx.acquireRoomLock(roomId);
    if (!locked) return { status: 409, data: { error: 'Room busy, try again' } };
    try {
        let room = await ctx.getRoomRaw(roomId);
        if (!room) return { status: 404, data: { error: 'Room not found' } };

        // Only spectators can chat during active game phases
        const isSpectator = (room.spectators || []).find(s => s.name === playerName);
        const isPlayer = room.players.find(p => p.name === playerName);
        if (!isSpectator && !isPlayer) return { status: 403, data: { error: 'Not in this room' } };
        if (isPlayer && ['submitting', 'betting', 'judging'].includes(room.status)) {
            return { status: 400, data: { error: 'Players cannot chat during active phases' } };
        }

        if (!room.chat) room.chat = [];
        room.chat.push({ playerName, text, at: Date.now(), isSpectator: !!isSpectator });
        if (room.chat.length > 50) room.chat = room.chat.slice(-50);
        room.updatedAt = Date.now();
        await ctx.setRoom(roomId, room);
        return { status: 200, data: { success: true } };
    } finally {
        await ctx.releaseRoomLock(roomId);
    }
}

/**
 * Send an emoji reaction on a submission during betting.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function sendReaction(body, ctx) {
    const { roomId, playerName, emoji } = body;
    const submissionId = parseInt(body.submissionId);
    if (!submissionId || isNaN(submissionId)) return { status: 400, data: { error: 'Invalid submission ID' } };

    const locked = await ctx.acquireRoomLock(roomId);
    if (!locked) return { status: 409, data: { error: 'Room busy, try again' } };
    try {
        let room = await ctx.getRoom(roomId);
        if (!room || room.status !== 'betting') return { status: 400, data: { error: 'Not in betting phase' } };
        if (!room.players.find(p => p.name === playerName)) return { status: 403, data: { error: 'Not a player' } };
        if (!room.submissions.find(s => s.id === submissionId)) return { status: 400, data: { error: 'Invalid submission' } };
        const ALLOWED_EMOJI = ['\u{1F602}','\u{1F525}','\u{1F480}','\u{1F610}','\u{1F44F}','\u{1F92E}'];
        if (!ALLOWED_EMOJI.includes(emoji)) return { status: 400, data: { error: 'Invalid emoji' } };
        if (!room.reactions) room.reactions = [];
        if (room.reactions.filter(r => r.playerName === playerName).length >= 3) return { status: 400, data: { error: 'Max reactions reached' } };
        room.reactions.push({ playerName, submissionId, emoji, at: Date.now() });
        room.updatedAt = Date.now();
        await ctx.setRoom(roomId, room);
        return { status: 200, data: { success: true } };
    } finally {
        await ctx.releaseRoomLock(roomId);
    }
}
