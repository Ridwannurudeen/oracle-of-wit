// AI-powered judging and generation via Claude API

import { logger } from './logger.js';

/** @type {string|undefined} */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
const AI_TIMEOUT_FULL = parseInt(process.env.AI_TIMEOUT_FULL) || 8000;
const AI_TIMEOUT_SIMPLE = parseInt(process.env.AI_TIMEOUT_SIMPLE) || 5000;
const AI_TIMEOUT_CURATION = parseInt(process.env.AI_TIMEOUT_CURATION) || 5000;
const AI_TIMEOUT_BOT = parseInt(process.env.AI_TIMEOUT_BOT) || 3000;

/**
 * Use AI to pick the funniest punchline from submissions.
 * Falls back to coin flip if AI is unavailable.
 * @param {import('./types.js').Submission[]} submissions
 * @param {string} jokePrompt
 * @param {string} category
 * @returns {Promise<import('./types.js').AIJudgment>}
 */
export async function pickWinnerWithAI(submissions, jokePrompt, category) {
    if (!submissions?.length) return { winnerId: null, aiCommentary: null, judgingMethod: 'none' };
    if (submissions.length === 1) return { winnerId: submissions[0].id, aiCommentary: null, judgingMethod: 'single_entry' };

    if (!ANTHROPIC_API_KEY) {
        logger.info('No Anthropic API key, using coin flip', { service: 'judge' });
        return { winnerId: submissions[Math.floor(Math.random() * submissions.length)].id, aiCommentary: null, judgingMethod: 'coin_flip' };
    }

    const submissionsList = submissions.map(s =>
        `[ID: ${s.id}] "${s.punchline}"`
    ).join('\n');

    // Three attempts with decreasing prompt complexity:
    // 1. Full structured prompt (JSON response with commentary)
    // 2. Simplified prompt (just a winner ID number)
    // 3. Random selection (coin flip)
    // Each tier catches the previous tier's failure mode.

    // --- ATTEMPT 1: Full prompt (winner + roast + commentary) ---
    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), AI_TIMEOUT_FULL);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller1.signal,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 400,
                messages: [{
                    role: 'user',
                    content: `You are the Oracle of Wit, a savage comedy judge. Pick the FUNNIEST punchline.

JOKE SETUP: "${jokePrompt}"
CATEGORY: ${category}

PUNCHLINES:
${submissionsList}

Judge on: humor, cleverness, relevance, surprise factor.

Respond with ONLY valid JSON (no markdown, no backticks, no explanation):
{"winnerId": <number>, "winnerComment": "<1 witty sentence>", "roasts": {${submissions.map(s => `"${s.id}": "<1 sentence>"`).join(', ')}}}`
                }]
            })
        });

        if (response.ok) {
            const data = await response.json();
            const aiResponse = data.content?.[0]?.text?.trim();
            try {
                const parsed = JSON.parse(aiResponse);
                const winnerId = parseInt(parsed.winnerId);
                if (winnerId && submissions.find(s => s.id === winnerId)) {
                    logger.info('Attempt 1 success', { service: 'judge', winnerId });
                    if (parsed.roasts) delete parsed.roasts[String(winnerId)];
                    return {
                        winnerId,
                        aiCommentary: { winnerComment: parsed.winnerComment || null, roasts: parsed.roasts || {} },
                        judgingMethod: 'claude_api'
                    };
                }
            } catch (parseErr) {
                logger.warn('Attempt 1 JSON parse failed, trying regex', { service: 'judge' });
                const match = aiResponse?.match(/"winnerId"\s*:\s*(\d+)/);
                if (match) {
                    const winnerId = parseInt(match[1]);
                    if (submissions.find(s => s.id === winnerId)) {
                        logger.info('Attempt 1 regex fallback', { service: 'judge', winnerId });
                        return { winnerId, aiCommentary: null, judgingMethod: 'claude_api' };
                    }
                }
            }
        }
        logger.info('Attempt 1 failed, trying simplified prompt', { service: 'judge' });
    } catch (e) {
        logger.error('Attempt 1 error', { service: 'judge', error: e.message });
    } finally {
        clearTimeout(timeout1);
    }

    // --- ATTEMPT 2: Simplified prompt (just pick a number) ---
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), AI_TIMEOUT_SIMPLE);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: controller2.signal,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 10,
                messages: [{
                    role: 'user',
                    content: `Which punchline is funniest for "${jokePrompt}"?\n${submissionsList}\nReply with ONLY the ID number, nothing else.`
                }]
            })
        });

        if (response.ok) {
            const data = await response.json();
            const text = data.content?.[0]?.text?.trim();
            const winnerId = parseInt(text);
            if (winnerId && submissions.find(s => s.id === winnerId)) {
                logger.info('Attempt 2 success', { service: 'judge', winnerId });
                return { winnerId, aiCommentary: null, judgingMethod: 'claude_api' };
            }
        }
        logger.info('Attempt 2 failed', { service: 'judge' });
    } catch (e) {
        logger.error('Attempt 2 error', { service: 'judge', error: e.message });
    } finally {
        clearTimeout(timeout2);
    }

    // --- FINAL FALLBACK: Coin flip ---
    const winnerId = submissions[Math.floor(Math.random() * submissions.length)].id;
    logger.info('Coin flip fallback', { service: 'judge', winnerId });
    return { winnerId, aiCommentary: null, judgingMethod: 'coin_flip' };
}

/**
 * Use AI to curate the top 8 funniest submissions for audience voting.
 * @param {import('./types.js').Submission[]} submissions
 * @param {string} jokePrompt
 * @param {string} category
 * @returns {Promise<number[]|null>} Array of curated submission IDs, or null on failure.
 */
export async function curateSubmissions(submissions, jokePrompt, category) {
    if (!ANTHROPIC_API_KEY || submissions.length < 8) return null;

    const submissionsList = submissions.map(s => `[ID:${s.id}] "${s.punchline}"`).join('\n');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_CURATION);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 100,
                messages: [{
                    role: 'user',
                    content: `You are curating a comedy contest. Pick the 8 funniest punchlines from these submissions for the joke: "${jokePrompt}" (Category: ${category}).

${submissionsList}

Return ONLY a JSON array of the 8 IDs (numbers), e.g. [1,3,5,7,8,12,15,20]. No text.`
                }]
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        const text = data.content?.[0]?.text?.trim();
        if (!text) return null;

        const match = text.match(/\[[\d,\s]+\]/);
        if (!match) return null;
        const ids = JSON.parse(match[0]).filter(id => typeof id === 'number');
        if (ids.length < 4) return null;
        return ids.slice(0, 8);
    } catch (e) {
        logger.info('AI curation failed', { service: 'curate', error: e.message });
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Generate dynamic punchlines for bot players using AI.
 * @param {string} jokePrompt
 * @param {string} category
 * @param {number} [count=3]
 * @returns {Promise<string[]|null>} Array of punchline strings, or null on failure.
 */
export async function generateBotPunchlines(jokePrompt, category, count = 3) {
    if (!ANTHROPIC_API_KEY) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_BOT);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 200,
                messages: [{
                    role: 'user',
                    content: `Generate ${count} funny punchlines for this joke setup: "${jokePrompt}"
Category: ${category}. Each should have a distinct comedy style:
1. Clever wordplay
2. Absurd/surreal
3. Dark/edgy

Return ONLY a JSON array of ${count} strings, no markdown:
["punchline1", "punchline2", "punchline3"]`
                }]
            })
        });

        if (!response.ok) { logger.warn('AI response not ok, falling back', { service: 'bots' }); return null; }
        const data = await response.json();
        const text = data.content?.[0]?.text?.trim();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
            if (parsed.length < count) {
                logger.warn('AI returned partial punchlines', { service: 'bots', got: parsed.length, expected: count });
            } else {
                logger.info('Generated dynamic punchlines via AI', { service: 'bots', count });
            }
            return parsed.slice(0, count);
        }
        logger.warn('AI returned empty or non-array, falling back', { service: 'bots' });
        return null;
    } catch (e) {
        logger.warn('AI generation failed, using hardcoded fallback', { service: 'bots', error: e.message });
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Pick a random winner from submissions (coin flip fallback).
 * @param {import('./types.js').Submission[]} submissions
 * @returns {number|null} The winning submission ID, or null if no submissions.
 */
export function pickWinnerRandom(submissions) {
    if (!submissions?.length) return null;
    return submissions[Math.floor(Math.random() * submissions.length)].id;
}
