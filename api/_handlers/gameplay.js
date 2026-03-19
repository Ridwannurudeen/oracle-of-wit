// Core game action handlers: startGame, submitPunchline, placeBet, castVote, advancePhase, nextRound, sendReaction

import { SUBMISSION_TIME, VOTING_TIME } from '../_lib/constants.js';
import { pickWinnerWithAI, curateSubmissions } from '../_lib/ai.js';
import { transitionFromSubmitting, autoJudge, tallyVotesAndJudge, addBotBets, getNextPrompt } from '../_lib/game-logic.js';
import { recordOnChain, postGameToDiscord } from '../_lib/genlayer.js';
import { getProfile, saveProfile, checkAchievements } from '../_lib/profiles.js';
import { tursoRecordGameHistory } from '../_lib/turso.js';

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
    room.phaseEndsAt = now + SUBMISSION_TIME;
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
    let room = await ctx.getRoom(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };
    if (room.host !== hostName) return { status: 403, data: { error: 'Only host can advance' } };

    const now = Date.now();
    if (room.status === 'submitting') {
        await transitionFromSubmitting(room, ctx.setRoom);
    } else if (room.status === 'curating') {
        if (!room.curatedIds) {
            const ids = await curateSubmissions(room.submissions, room.jokePrompt, room.category);
            room.curatedIds = ids || [...room.submissions].sort(() => Math.random() - 0.5).slice(0, 8).map(s => s.id);
        }
        room.status = 'voting';
        room.audienceVotes = {};
        room.phaseEndsAt = now + VOTING_TIME;
        room.updatedAt = now;
        await ctx.setRoom(roomId, room);
    } else if (room.status === 'voting') {
        room = await tallyVotesAndJudge(room, ctx.setRoom);
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
        await ctx.setRoom(roomId, room);

        // Turso game history (fire-and-forget)
        tursoRecordGameHistory(roomId, room).catch(() => {});

        // GenLayer record with 1 retry
        (async () => {
            try {
                const result = await recordOnChain(roomId, room.players);
                if (!result) {
                    await new Promise(r => setTimeout(r, 2000));
                    await recordOnChain(roomId, room.players);
                }
            } catch (e) {
                console.error('[GenLayer] record_game_result failed after retry:', e.message);
            }
        })();
        postGameToDiscord(room).catch(e => console.error('[Discord] error:', e.message));

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
    room.phaseEndsAt = now + SUBMISSION_TIME;
    room.roundStartedAt = now;
    room.updatedAt = now;
    await ctx.setRoom(roomId, room);
    return { status: 200, data: { success: true, room } };
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
