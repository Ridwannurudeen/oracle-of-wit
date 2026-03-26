// Social/community feature handlers

import { redisGet, redisSet } from '../_lib/redis.js';
import { appealWithGenLayer, pollGenLayerResult, readHallOfFame } from '../_lib/genlayer.js';
import { getProfile, saveProfile } from '../_lib/profiles.js';

/**
 * Create a friend challenge with a custom prompt.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function createChallenge(body, ctx) {
    const { creatorName, category } = body;
    const prompt = ctx.sanitizeInput(body.prompt);
    if (!creatorName || !prompt) return { status: 400, data: { error: 'creatorName and prompt required' } };
    if (prompt.length > 150) return { status: 400, data: { error: 'Prompt too long (max 150 characters)' } };
    const safeCategory = ctx.VALID_CATEGORIES.includes(category) ? category : 'general';
    const challengeId = Math.random().toString(36).substring(2, 10);
    await redisSet(`challenge:${challengeId}`, { creatorName, creatorScore: 0, prompt, category: safeCategory, createdAt: Date.now() }, 86400 * 7);
    return { status: 200, data: { success: true, challengeId } };
}

/**
 * Get a friend challenge by ID.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function getChallenge(body, ctx) {
    const challengeId = ctx.query.id || body.challengeId;
    if (!challengeId) return { status: 400, data: { error: 'challengeId required' } };
    const challenge = await redisGet(`challenge:${challengeId}`);
    if (!challenge) return { status: 404, data: { error: 'Challenge not found or expired' } };
    return { status: 200, data: { success: true, challenge } };
}

/**
 * Appeal a round verdict using AI re-judging and GenLayer.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function appealVerdict(body, ctx) {
    const { roomId, playerName, roundIndex, playerId } = body;
    let room = await ctx.getRoom(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };
    if (room.status !== 'roundResults') return { status: 400, data: { error: 'Not in results phase' } };

    const result = room.roundResults[roundIndex !== undefined ? roundIndex : room.roundResults.length - 1];
    if (!result) return { status: 400, data: { error: 'No round result to appeal' } };
    if (result.appealed) return { status: 400, data: { error: 'Already appealed' } };

    if (!playerId) return { status: 400, data: { error: 'playerId required for appeals' } };
    const profile = await getProfile(playerId);
    if (profile && profile.lifetimeXP < 50) return { status: 400, data: { error: 'Need 50 XP to appeal' } };

    const submissions = room.submissions;
    const validIds = submissions.map(s => s.id);

    // GenLayer-primary: submit appeal to chain first, wait for OD result
    const glAppeal = await appealWithGenLayer(room.id, room.jokePrompt, room.category, submissions, result.winnerId).catch(() => null);

    let appealOnChain = false, appealTxHash = null;
    let newWinnerId = null;

    if (glAppeal?.txHash) {
        appealOnChain = true;
        appealTxHash = glAppeal.txHash;
        const pollResult = await pollGenLayerResult(appealTxHash, 30000);
        const glWinnerId = pollResult?.winnerId ?? null;
        if (glWinnerId && validIds.includes(glWinnerId)) {
            newWinnerId = glWinnerId;
        }
    }

    // If GenLayer failed, original verdict stands
    const overturned = newWinnerId && newWinnerId !== result.winnerId;

    result.appealed = true;
    result.appealResult = overturned ? 'overturned' : 'upheld';
    result.appealNewWinnerId = newWinnerId;

    if (overturned) {
        const oldWinner = room.players.find(p => p.name === result.winnerName);
        if (oldWinner) oldWinner.score = Math.max(0, oldWinner.score - 100);
        const newWinnerSub = submissions.find(s => s.id === newWinnerId);
        if (newWinnerSub) {
            const nwp = room.players.find(p => p.name === newWinnerSub.playerName);
            if (nwp) nwp.score += 100;
            result.appealNewWinnerName = newWinnerSub.playerName;
            result.appealNewPunchline = newWinnerSub.punchline;
        }
    } else if (playerId) {
        const penaltyProfile = await getProfile(playerId);
        if (penaltyProfile) { penaltyProfile.lifetimeXP = Math.max(0, penaltyProfile.lifetimeXP - 50); await saveProfile(penaltyProfile); }
    }

    result.appealOnChain = appealOnChain;
    result.appealTxHash = appealTxHash;
    await ctx.setRoom(roomId, room);
    return { status: 200, data: {
        success: true,
        appeal: { overturned, newWinnerId, oldWinnerId: result.winnerId, onChain: appealOnChain, txHash: appealTxHash },
        room
    }};
}

/**
 * Generate an Open Graph preview HTML page for social sharing.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function ogPreview(body, ctx) {
    const shareId = ctx.query.id;
    if (!shareId) return { status: 400, data: { error: 'id required' } };
    if (!/^[a-z0-9]{6,12}$/i.test(shareId)) return { status: 400, data: { error: 'Invalid share ID format' } };
    const shareData = await redisGet(`share:${shareId}`);
    const title = shareData?.winnerName ? `${shareData.winnerName} won Oracle of Wit!` : 'Oracle of Wit - GenLayer Game';
    const desc = shareData?.punchline || 'The AI humor prediction game powered by GenLayer';
    const url = 'https://oracle-of-wit.vercel.app';
    const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
    const html = `<!DOCTYPE html><html><head>
        <meta property="og:title" content="${esc(title)}" />
        <meta property="og:description" content="${esc(desc)}" />
        <meta property="og:image" content="${url}/og-image.png" />
        <meta property="og:url" content="${url}/share/${esc(shareId)}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${esc(title)}" />
        <meta name="twitter:description" content="${esc(desc)}" />
        <meta http-equiv="refresh" content="0; url=${url}" />
    </head><body>Redirecting...</body></html>`;
    return { status: 200, html };
}

/**
 * Create a shareable link for a game result.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function createShare(body, ctx) {
    const { winnerName, punchline, prompt, score, category } = body;
    const shareId = Math.random().toString(36).substring(2, 10);
    await redisSet(`share:${shareId}`, { winnerName, punchline, prompt, score, category, createdAt: Date.now() }, 86400 * 30);
    return { status: 200, data: { success: true, shareId } };
}

/**
 * Get the hall of fame (best winning jokes).
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function getHallOfFame(body, ctx) {
    // Try GenLayer first, Redis as transition fallback
    const chainHof = await readHallOfFame(50);
    if (chainHof && Array.isArray(chainHof) && chainHof.length > 0) {
        return { status: 200, data: { success: true, hallOfFame: chainHof, source: 'genlayer' } };
    }
    const hof = await redisGet('hall_of_fame') || [];
    return { status: 200, data: { success: true, hallOfFame: hof, source: 'redis' } };
}

/**
 * Submit a community-created joke prompt.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function submitPrompt(body, ctx) {
    const { playerId } = body;
    const playerName = ctx.sanitizeInput(body.playerName);
    const userPrompt = ctx.sanitizeInput(body.prompt);
    if (!playerName || !userPrompt) return { status: 400, data: { error: 'playerName and prompt required' } };
    if (playerName.length > 30) return { status: 400, data: { error: 'Player name too long (max 30 characters)' } };
    if (userPrompt.length < 10 || userPrompt.length > 150) return { status: 400, data: { error: 'Prompt must be 10-150 characters' } };

    const prompts = await redisGet('community_prompts') || [];
    if (prompts.some(p => p.playerId === playerId && Date.now() - p.createdAt < 86400000)) return { status: 400, data: { error: 'One submission per day' } };
    const promptId = Math.random().toString(36).substring(2, 10);
    prompts.push({ id: promptId, prompt: userPrompt, author: playerName, playerId, votes: 0, voters: [], status: 'pending', createdAt: Date.now() });
    await redisSet('community_prompts', prompts, 86400 * 90);
    return { status: 200, data: { success: true, promptId } };
}

/**
 * Vote for a community prompt (auto-approves at 5 votes).
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function votePrompt(body, ctx) {
    const { promptId, playerId } = body;
    if (!promptId || !playerId) return { status: 400, data: { error: 'promptId and playerId required' } };
    const prompts = await redisGet('community_prompts') || [];
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return { status: 404, data: { error: 'Prompt not found' } };
    if (prompt.playerId === playerId) return { status: 400, data: { error: 'Cannot vote for your own prompt' } };
    if (prompt.voters.includes(playerId)) return { status: 400, data: { error: 'Already voted' } };
    prompt.votes++;
    prompt.voters.push(playerId);
    if (prompt.votes >= 5 && prompt.status === 'pending') prompt.status = 'approved';
    await redisSet('community_prompts', prompts, 86400 * 90);
    return { status: 200, data: { success: true, votes: prompt.votes, status: prompt.status } };
}

/**
 * Get all community prompt submissions sorted by votes.
 * @param {Object} body
 * @param {import('../_lib/types.js').HandlerContext} ctx
 * @returns {Promise<import('../_lib/types.js').HandlerResult>}
 */
export async function getPromptSubmissions(body, ctx) {
    const prompts = await redisGet('community_prompts') || [];
    return { status: 200, data: { success: true, prompts: [...prompts].sort((a, b) => b.votes - a.votes).slice(0, 50) } };
}
