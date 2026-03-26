// Game logic: judging, round results, phase transitions, bots, prompts

import { redisGet, redisSet, redisSetNX, redisDel } from './redis.js';
import { SUBMISSION_TIME, BETTING_TIME, BOT_NAMES, PROMPT_PUNCHLINES, FALLBACK_PUNCHLINES, WEEKLY_THEMES, CATEGORIZED_PROMPTS, getCurrentTheme } from './constants.js';
import { logger } from './logger.js';
import { submitToGenLayer, pollGenLayerResult } from './genlayer.js';

/**
 * Pick a random winner from submissions (coin flip fallback).
 * @param {import('./types.js').Submission[]} submissions
 * @returns {number|null} The winning submission ID, or null if no submissions.
 */
export function pickWinnerRandom(submissions) {
    if (!submissions?.length) return null;
    return submissions[Math.floor(Math.random() * submissions.length)].id;
}

// --- Phase transitions ---

/**
 * Transition room from submitting phase to next phase (curating or betting).
 * @param {import('./types.js').Room} room
 * @param {function(string, import('./types.js').Room): Promise<boolean>} setRoom
 * @returns {Promise<void>}
 */
export async function transitionFromSubmitting(room, setRoom) {
    const now = Date.now();
    if (room.isSinglePlayer) await addBotSubmissions(room);
    if (room.submissions.length < 1) {
        room.status = 'roundResults';
        room.roundResults = room.roundResults || [];
        room.roundResults.push({ round: room.currentRound, winnerId: null, winnerName: 'No one', winningPunchline: 'No submissions', scores: {}, judgingMethod: 'skipped' });
        return;
    }

    room.status = 'betting';
    room.bets = [];
    room.reactions = [];
    room.phaseEndsAt = now + BETTING_TIME;
    room.updatedAt = now;
    await setRoom(room.id, room);
}

/**
 * Check if the room should auto-advance to the next phase based on timers.
 * @param {import('./types.js').Room} room
 * @param {function(string, import('./types.js').Room): Promise<boolean>} setRoom
 * @returns {Promise<import('./types.js').Room>}
 */
export async function checkAutoAdvance(room, setRoom) {
    if (!room?.phaseEndsAt) return room;
    const now = Date.now();

    if (room.status === 'submitting' && now >= room.phaseEndsAt) {
        await transitionFromSubmitting(room, setRoom);
    } else if (room.status === 'betting' && now >= room.phaseEndsAt) {
        if (room.isSinglePlayer) {
            addBotBets(room);
            await setRoom(room.id, room);
        }
        room = await autoJudge(room, setRoom);
    } else if (room.status === 'judging' && room.updatedAt && now - room.updatedAt > 45000) {
        // Recovery: room stuck in judging (e.g. previous autoJudge timed out)
        logger.warn('Room stuck in judging, retrying', { service: 'game', roomId: room.id, stuckFor: now - room.updatedAt });
        room = await autoJudge(room, setRoom);
    }

    return room;
}

// --- Distributed lock for auto-advance (replaces in-memory Set) ---

/**
 * Acquire a distributed lock for auto-advance to prevent concurrent transitions.
 * @param {string} roomId
 * @returns {Promise<boolean>}
 */
export async function acquireAdvanceLock(roomId) {
    return await redisSetNX(`lock:advance:${roomId}`, 1, 35);
}

/**
 * Release the distributed auto-advance lock.
 * @param {string} roomId
 * @returns {Promise<boolean>}
 */
export async function releaseAdvanceLock(roomId) {
    return await redisDel(`lock:advance:${roomId}`);
}

// --- Judging ---

/**
 * Automatically judge a round: GenLayer is the SOLE judge via Optimistic Democracy.
 * Falls back to coin flip only if GenLayer is unavailable.
 * @param {import('./types.js').Room} room
 * @param {function(string, import('./types.js').Room): Promise<boolean>} setRoom
 * @returns {Promise<import('./types.js').Room>}
 */
export async function autoJudge(room, setRoom) {
    const now = Date.now();
    room.status = 'judging';
    room.judgingMethod = 'processing';
    await setRoom(room.id, room);

    // Step 1: Submit to GenLayer (sole judge)
    const genLayerResult = await submitToGenLayer(room.submissions, room.jokePrompt, room.category, room.id).catch(() => null);

    let winnerId = null;
    let judgingMethod = null;
    let onChain = false;
    let txHash = null;
    let glOverride = false;
    let aiCommentary = null;

    // Step 2: Poll GenLayer for OD consensus result (winner + commentary)
    if (genLayerResult?.txHash) {
        txHash = genLayerResult.txHash;
        onChain = true;
        const validIds = room.submissions.map(s => s.id);
        const pollResult = await pollGenLayerResult(txHash);
        const glWinnerId = pollResult?.winnerId ?? null;
        const glCommentary = pollResult?.commentary ?? null;

        if (glWinnerId && validIds.includes(glWinnerId)) {
            winnerId = glWinnerId;
            judgingMethod = 'genlayer_optimistic_democracy';
            glOverride = true;
            aiCommentary = glCommentary;
            logger.info('GenLayer OD authoritative winner', { service: 'judge', winnerId, txHash });
        } else if (glWinnerId) {
            logger.warn('GenLayer winnerId not in valid range', { service: 'genlayer', glWinnerId, validIds, txHash });
        } else {
            logger.info('GenLayer poll timed out or returned null', { service: 'genlayer', txHash });
        }
    }

    // Step 3: If GenLayer failed, coin flip
    if (!winnerId) {
        room.genLayerFailed = true;
        winnerId = pickWinnerRandom(room.submissions);
        judgingMethod = 'coin_flip';
        logger.warn('GenLayer unavailable, using coin flip', { service: 'judge', roomId: room.id, winnerId });
    }

    if (winnerId) {
        logger.info('Winner determined', { service: 'judge', winnerId, judgingMethod, onChain, glOverride });
    }

    const winningSubmission = room.submissions.find(s => s.id === winnerId);
    if (!winningSubmission) {
        const fallbackWinner = room.submissions[0];
        return createRoundResult(room, fallbackWinner.id, now, 'fallback', false, null, null, setRoom);
    }

    return createRoundResult(room, winnerId, now, judgingMethod, onChain, aiCommentary, txHash, setRoom, glOverride);
}

/**
 * Create a round result, update scores, streaks, hall of fame, and persist.
 * @param {import('./types.js').Room} room
 * @param {number} winnerId
 * @param {number} now
 * @param {string} [judgingMethod='unknown']
 * @param {boolean} [onChain=false]
 * @param {Object|null} [aiCommentary=null]
 * @param {string|null} [txHash=null]
 * @param {function(string, import('./types.js').Room): Promise<boolean>|null} [setRoom=null]
 * @param {boolean} [glOverride=false]
 * @returns {Promise<import('./types.js').Room>}
 */
export async function createRoundResult(room, winnerId, now, judgingMethod = 'unknown', onChain = false, aiCommentary = null, txHash = null, setRoom = null, glOverride = false) {
    const winningSubmission = room.submissions.find(s => s.id === winnerId);

    if (!winningSubmission) {
        const fallback = room.submissions[0];
        if (!fallback) {
            room.status = 'roundResults';
            room.roundResults = room.roundResults || [];
            room.roundResults.push({ round: room.currentRound, winnerId: null, winnerName: 'No one', winningPunchline: 'No submissions', scores: {}, judgingMethod: 'skipped' });
            room.phaseEndsAt = null;
            if (setRoom) await setRoom(room.id, room);
            return room;
        }
        return createRoundResult(room, fallback.id, now, 'fallback', onChain, aiCommentary, txHash, setRoom, glOverride);
    }

    const roundResult = {
        round: room.currentRound,
        winnerId,
        winnerName: winningSubmission.playerName,
        winningPunchline: winningSubmission.punchline,
        judgingMethod,
        onChain,
        txHash,
        aiCommentary,
        glOverride,
        scores: {}
    };

    const authorPlayer = room.players.find(p => p.name === winningSubmission.playerName);
    if (authorPlayer) {
        authorPlayer.score += 100;
        roundResult.scores[authorPlayer.name] = 100;
    }

    room.bets.forEach(bet => {
        if (bet.submissionId === winnerId) {
            const betPlayer = room.players.find(p => p.name === bet.playerName);
            if (betPlayer) {
                betPlayer.score += bet.amount * 2;
                roundResult.scores[bet.playerName] = (roundResult.scores[bet.playerName] || 0) + bet.amount * 2;
            }
        }
    });

    room.bets.forEach(bet => {
        if (bet.submissionId !== winnerId) {
            const betPlayer = room.players.find(p => p.name === bet.playerName);
            if (betPlayer) {
                const oldScore = betPlayer.score;
                betPlayer.score = Math.max(0, betPlayer.score - bet.amount);
                const actualPenalty = betPlayer.score - oldScore;
                roundResult.scores[bet.playerName] = (roundResult.scores[bet.playerName] || 0) + actualPenalty;
            }
        }
    });

    const otherIds = room.submissions.map(s => s.id).filter(id => id !== winnerId);
    const shuffled = otherIds.sort(() => Math.random() - 0.5);
    roundResult.revealOrder = [...shuffled, winnerId];

    if (!room.streaks) room.streaks = {};
    for (const p of room.players) {
        if (!room.streaks[p.name]) room.streaks[p.name] = 0;
    }
    room.streaks[winningSubmission.playerName] = (room.streaks[winningSubmission.playerName] || 0) + 1;
    for (const p of room.players) {
        if (p.name !== winningSubmission.playerName) room.streaks[p.name] = 0;
    }
    roundResult.streak = room.streaks[winningSubmission.playerName];

    const sortedBefore = [...room.players].sort((a, b) =>
        (b.score - (roundResult.scores[b.name] || 0)) - (a.score - (roundResult.scores[a.name] || 0))
    );
    roundResult.isComeback = sortedBefore.length > 1 && sortedBefore[sortedBefore.length - 1]?.name === winningSubmission.playerName;

    room.roundResults.push(roundResult);
    room.status = 'roundResults';
    room.phaseEndsAt = null;
    room.updatedAt = now;
    room.lastJudgingMethod = judgingMethod;

    if (winningSubmission && !room.players.find(p => p.name === winningSubmission.playerName)?.isBot) {
        const jokeEntry = {
            prompt: room.jokePrompt,
            punchline: winningSubmission.punchline,
            author: winningSubmission.playerName,
            commentary: aiCommentary?.winnerComment || null,
            category: room.category,
            date: Date.now()
        };
        // Persist hall of fame to Redis (fire-and-forget)
        (async () => {
            try {
                const hof = await redisGet('hall_of_fame') || [];
                hof.unshift(jokeEntry);
                await redisSet('hall_of_fame', hof.slice(0, 50), 86400 * 365);
            } catch (e) {
                logger.error('Hall of fame Redis update failed', { service: 'game', error: e.message });
            }
        })();
    }

    if (setRoom) await setRoom(room.id, room);
    return room;
}

// --- Bots ---

/**
 * Add hardcoded punchline submissions for bot players.
 * @param {import('./types.js').Room} room
 * @returns {Promise<void>}
 */
export async function addBotSubmissions(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.submissions.find(s => s.playerName === p.name));
    if (botsToAdd.length === 0) return;

    const currentPrompt = room.jokePrompt;
    let availablePunchlines = PROMPT_PUNCHLINES[currentPrompt]
        ? [...PROMPT_PUNCHLINES[currentPrompt]]
        : null;

    if (!availablePunchlines) {
        const promptKey = Object.keys(PROMPT_PUNCHLINES).find(key =>
            currentPrompt.toLowerCase().includes(key.toLowerCase().slice(0, 30)) ||
            key.toLowerCase().includes(currentPrompt.toLowerCase().slice(0, 30))
        );
        if (promptKey) availablePunchlines = [...PROMPT_PUNCHLINES[promptKey]];
    }

    if (!availablePunchlines || availablePunchlines.length === 0) {
        availablePunchlines = [...(FALLBACK_PUNCHLINES[room.category] || FALLBACK_PUNCHLINES.general)];
    }

    botsToAdd.forEach(bot => {
        const unusedPunchlines = availablePunchlines.filter(p =>
            !room.submissions.find(s => s.punchline === p)
        );
        const punchlinePool = unusedPunchlines.length > 0 ? unusedPunchlines : availablePunchlines;
        const punchline = punchlinePool[Math.floor(Math.random() * punchlinePool.length)];
        const idx = availablePunchlines.indexOf(punchline);
        if (idx > -1) availablePunchlines.splice(idx, 1);

        room.submissions.push({
            id: room.submissions.length + 1,
            playerName: bot.name,
            punchline,
            submittedAt: Date.now()
        });
    });
}

/**
 * Add random bets for bot players.
 * @param {import('./types.js').Room} room
 * @returns {void}
 */
export function addBotBets(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.bets.find(b => b.playerName === p.name));

    botsToAdd.forEach(bot => {
        const validSubmissions = room.submissions.filter(s => s.playerName !== bot.name);
        if (validSubmissions.length > 0) {
            const pick = validSubmissions[Math.floor(Math.random() * validSubmissions.length)];
            room.bets.push({
                playerName: bot.name,
                submissionId: pick.id,
                amount: 30 + Math.floor(Math.random() * 50),
                placedAt: Date.now()
            });
        }
    });
}

// --- Prompts ---

/**
 * Get available prompts for a category, including weekly theme bonuses.
 * @param {string} category
 * @returns {string[]}
 */
export function getPromptsForCategory(category) {
    const base = CATEGORIZED_PROMPTS[category] || CATEGORIZED_PROMPTS.general;
    const theme = getCurrentTheme();
    const bonus = [...theme.bonusPrompts].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...base, ...bonus];
}

/**
 * Get the next joke prompt for a room, with community prompt chance.
 * @param {import('./types.js').Room} room
 * @returns {Promise<string>}
 */
export async function getNextPrompt(room) {
    // 30% chance to use a community-submitted prompt — balances freshness with quality.
    // Community prompts are pre-approved (5+ votes) so quality is maintained.
    if (Math.random() < 0.3) {
        try {
            const communityPrompts = await redisGet('community_prompts') || [];
            const approved = communityPrompts.filter(p => p.status === 'approved' && !room.usedPrompts.includes(p.prompt));
            if (approved.length > 0) {
                const pick = approved[Math.floor(Math.random() * approved.length)];
                room.usedPrompts.push(pick.prompt);
                room.promptSource = { type: 'community', author: pick.author };
                return pick.prompt;
            }
        } catch (e) {
            logger.info('Community prompts fetch failed, using hardcoded', { service: 'prompts', error: e.message });
        }
    }

    const prompts = getPromptsForCategory(room.category);
    const available = prompts.filter(p => !room.usedPrompts.includes(p));
    const prompt = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : prompts[Math.floor(Math.random() * prompts.length)];
    room.usedPrompts.push(prompt);
    room.promptSource = null;
    return prompt;
}
