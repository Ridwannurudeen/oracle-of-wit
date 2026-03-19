// Player profiles and leaderboard handlers

import { redisGet, redisSet } from '../lib/redis.js';
import { BOT_NAMES, PROMPT_PUNCHLINES, FALLBACK_PUNCHLINES, ACHIEVEMENTS } from '../lib/constants.js';
import { pickWinnerWithAI } from '../lib/ai.js';
import { getGenLayerClient } from '../lib/genlayer.js';
import { getProfile, saveProfile, createDefaultProfile, checkAchievements, getNextLevelXP, getTodayKey, getDailyPrompt, getCurrentSeasonKey } from '../lib/profiles.js';
import { generateToken, storePlayerSession } from '../lib/auth.js';
import { generateNonce, storeNonce, consumeNonce, verifySiweMessage } from '../lib/wallet-auth.js';
import { tursoUpsertUser } from '../lib/turso.js';

/**
 * Get the global leaderboard (top 20).
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getLeaderboard(body, ctx) {
    const leaderboard = await ctx.getLeaderboard();
    return { status: 200, data: { success: true, leaderboard: leaderboard.slice(0, 20) } };
}

/**
 * Get a player's profile by ID.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getProfileHandler(body, ctx) {
    const playerId = body.playerId || ctx.query.playerId;
    if (!playerId) return { status: 400, data: { error: 'playerId required' } };
    const profile = await getProfile(playerId);
    if (!profile) return { status: 404, data: { error: 'Profile not found' } };
    return { status: 200, data: { success: true, profile, nextLevelXP: getNextLevelXP(profile.lifetimeXP), achievements: ACHIEVEMENTS } };
}

/**
 * Create or update a player profile.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function createProfile(body, ctx) {
    const { playerId, playerName } = body;
    if (!playerId || !playerName) return { status: 400, data: { error: 'playerId and playerName required' } };
    let profile = await getProfile(playerId);
    if (!profile) { profile = createDefaultProfile(playerId, playerName); await saveProfile(profile); }
    else if (profile.name !== playerName) { profile.name = playerName; await saveProfile(profile); }

    // Issue a player-scoped session token for identity-dependent actions
    const playerSessionToken = generateToken();
    await storePlayerSession(playerId, playerSessionToken);

    return { status: 200, data: { success: true, profile, nextLevelXP: getNextLevelXP(profile.lifetimeXP), achievements: ACHIEVEMENTS, playerSessionToken } };
}

/**
 * Get today's daily challenge prompt and status.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getDailyChallenge(body, ctx) {
    const { playerId } = body;
    const dateKey = getTodayKey();
    const prompt = getDailyPrompt();
    const played = playerId ? await redisGet(`daily:${dateKey}:played:${playerId}`) : false;
    const lb = await redisGet(`daily:${dateKey}:lb`) || [];
    return { status: 200, data: { success: true, daily: { date: dateKey, prompt, alreadyPlayed: !!played, leaderboard: lb.slice(0, 20) } } };
}

/**
 * Submit a punchline for the daily challenge.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function submitDailyChallenge(body, ctx) {
    const { playerId, playerName, punchline } = body;
    if (!playerId || !playerName || !punchline) return { status: 400, data: { error: 'playerId, playerName, and punchline required' } };
    const dateKey = getTodayKey();
    const played = await redisGet(`daily:${dateKey}:played:${playerId}`);
    if (played) return { status: 400, data: { error: 'Already played today' } };

    const prompt = getDailyPrompt();
    const startTime = Date.now();
    const submissions = [{ id: 1, playerName, punchline }];
    const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, 3);
    let botPunchlines = PROMPT_PUNCHLINES[prompt] ? [...PROMPT_PUNCHLINES[prompt]] : null;
    if (!botPunchlines) {
        const cat = prompt.toLowerCase().includes('crypto') ? 'crypto' : prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('program') ? 'tech' : 'general';
        botPunchlines = [...(FALLBACK_PUNCHLINES[cat] || FALLBACK_PUNCHLINES.general)];
    }
    shuffledBots.forEach((botName, i) => {
        submissions.push({ id: i + 2, playerName: botName, punchline: botPunchlines[i] || botPunchlines[0] });
    });

    const aiResult = await pickWinnerWithAI(submissions, prompt, 'general');
    const winnerId = aiResult.winnerId || 1;
    const playerWon = winnerId === 1;
    const timeTaken = (Date.now() - startTime) / 1000;

    let score = playerWon ? 100 : 0;
    score += Math.max(0, Math.floor(50 - timeTaken));
    let profile = await getProfile(playerId);
    if (profile) {
        const yesterday = new Date(Date.now() - 86400000);
        const yesterdayKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth()+1).padStart(2,'0')}-${String(yesterday.getUTCDate()).padStart(2,'0')}`;
        if (profile.lastDailyDate === yesterdayKey) profile.dailyChallengeStreak++;
        else if (profile.lastDailyDate !== dateKey) profile.dailyChallengeStreak = 1;
        score += profile.dailyChallengeStreak * 10;
        profile.lastDailyDate = dateKey;
        profile.lifetimeXP += score;
        if (playerWon) profile.roundsWon++;
        const newAchievements = checkAchievements(profile);
        await saveProfile(profile);
        await redisSet(`daily:${dateKey}:played:${playerId}`, true, 86400 * 2);
        const lb = await redisGet(`daily:${dateKey}:lb`) || [];
        lb.push({ name: playerName, score, won: playerWon, time: Math.round(timeTaken) });
        lb.sort((a, b) => b.score - a.score);
        await redisSet(`daily:${dateKey}:lb`, lb.slice(0, 100), 86400 * 2);
        return { status: 200, data: {
            success: true,
            result: {
                won: playerWon, score, prompt, punchline, winnerId,
                winnerName: submissions.find(s => s.id === winnerId)?.playerName,
                winningPunchline: submissions.find(s => s.id === winnerId)?.punchline,
                aiCommentary: aiResult.aiCommentary, streak: profile.dailyChallengeStreak,
                leaderboard: lb.slice(0, 20), newAchievements, profile
            }
        }};
    }
    return { status: 200, data: { success: true, result: { won: playerWon, score, prompt, winnerId } } };
}

/**
 * Get a player's game history (GenLayer or Redis fallback).
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getPlayerHistory(body, ctx) {
    const playerName = body.playerName || ctx.query.playerName;
    if (!playerName) return { status: 400, data: { error: 'playerName required' } };

    const client = await getGenLayerClient();
    if (!client) {
        const lb = await ctx.getLeaderboard();
        const entry = lb.find(p => p.name === playerName);
        return { status: 200, data: { success: true, source: 'redis', history: { player_name: playerName, total_score: entry?.totalScore || 0, games_played: entry?.gamesPlayed || 0, games: [] } } };
    }
    try {
        const result = await client.readContract({ address: ctx.GENLAYER_CONTRACT_ADDRESS, functionName: 'get_player_history', args: [playerName] });
        return { status: 200, data: { success: true, source: 'genlayer', history: result } };
    } catch (err) {
        const lb = await ctx.getLeaderboard();
        const entry = lb.find(p => p.name === playerName);
        return { status: 200, data: { success: true, source: 'redis_fallback', history: { player_name: playerName, total_score: entry?.totalScore || 0, games_played: entry?.gamesPlayed || 0, games: [] } } };
    }
}

/**
 * Get the seasonal leaderboard for a given month.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getSeasonalLeaderboard(body, ctx) {
    const season = body.season || ctx.query.season || getCurrentSeasonKey();
    const slb = await redisGet(`leaderboard:${season}`) || [];
    return { status: 200, data: { success: true, season, leaderboard: slb.slice(0, 50) } };
}

/**
 * Get archived season data from GenLayer.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function getSeasonArchive(body, ctx) {
    const seasonId = body.seasonId || ctx.query.seasonId;
    if (!seasonId) return { status: 400, data: { error: 'seasonId required' } };
    const client = await getGenLayerClient();
    if (!client) return { status: 200, data: { success: true, source: 'unavailable', archive: null } };
    try {
        const result = await client.readContract({ address: ctx.GENLAYER_CONTRACT_ADDRESS, functionName: 'get_season', args: [seasonId] });
        return { status: 200, data: { success: true, source: 'genlayer', archive: result } };
    } catch (err) {
        return { status: 200, data: { success: true, source: 'error', archive: null } };
    }
}

// ── Wallet Authentication (EIP-4361 / SIWE) ────────────────────

/**
 * Generate and return a SIWE nonce for wallet authentication.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function requestNonce(body, ctx) {
    const nonce = generateNonce();
    await storeNonce(nonce);
    return { status: 200, data: { success: true, nonce } };
}

/**
 * Verify a SIWE signature, upsert user in Turso, create/load profile,
 * and issue a player session token.
 * @param {Object} body
 * @param {import('../lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../lib/types.js').HandlerResult>}
 */
export async function verifyWallet(body, ctx) {
    const { message, signature } = body;
    if (!message || !signature) return { status: 400, data: { error: 'message and signature required' } };

    const verified = await verifySiweMessage(message, signature);
    if (!verified) return { status: 401, data: { error: 'Signature verification failed' } };

    // Consume the nonce (one-time use)
    const nonceValid = await consumeNonce(verified.nonce);
    if (!nonceValid) return { status: 401, data: { error: 'Invalid or expired nonce' } };

    const walletAddress = verified.address.toLowerCase();

    // Upsert user in Turso (fire-and-forget if Turso unavailable)
    tursoUpsertUser({ walletAddress, displayName: body.displayName }).catch(() => {});

    // Use wallet address as the playerId for profiles
    const playerId = `wallet:${walletAddress}`;
    let profile = await getProfile(playerId);
    if (!profile) {
        const displayName = body.displayName || walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
        profile = createDefaultProfile(playerId, displayName);
        await saveProfile(profile);
    }

    // Issue player session token
    const playerSessionToken = generateToken();
    await storePlayerSession(playerId, playerSessionToken);

    return { status: 200, data: {
        success: true,
        walletAddress,
        playerId,
        profile,
        nextLevelXP: getNextLevelXP(profile.lifetimeXP),
        achievements: ACHIEVEMENTS,
        playerSessionToken,
    }};
}
