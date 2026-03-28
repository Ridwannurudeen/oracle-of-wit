// GenLayer SDK integration — Testnet Bradbury
// GenLayer is the PRIMARY backbone of Oracle of Wit.
// All judging goes through Optimistic Democracy on-chain.

import { logger } from './logger.js';

const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS?.trim();
const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY?.trim();
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

let _glClient = null;
const GL_POLL_TIMEOUT = parseInt(process.env.GL_POLL_TIMEOUT) || 30000;

// --- Circuit breaker (AI consensus calls only) ---
// Trips after 3 consecutive failures, auto-resets after 60s.
// Only gates submitToGenLayer, pollGenLayerResult, and appealWithGenLayer.
// Deterministic calls (create/register/record/finalize/read) bypass the breaker
// because AI judging failures shouldn't block game lifecycle recording.
let _consecutiveFailures = 0;
let _circuitTrippedAt = 0;
const CB_THRESHOLD = 3;
const CB_RESET_MS = 60000;

/**
 * Check if the GenLayer circuit breaker is closed (available).
 * @returns {boolean}
 */
export function isGenLayerAvailable() {
    if (_consecutiveFailures < CB_THRESHOLD) return true;
    if (Date.now() - _circuitTrippedAt >= CB_RESET_MS) {
        // Auto-reset: allow a probe request
        _consecutiveFailures = 0;
        _circuitTrippedAt = 0;
        return true;
    }
    return false;
}

function _recordSuccess() {
    _consecutiveFailures = 0;
    _circuitTrippedAt = 0;
}

function _recordFailure() {
    _consecutiveFailures++;
    if (_consecutiveFailures >= CB_THRESHOLD) {
        _circuitTrippedAt = Date.now();
        logger.warn('Circuit breaker OPEN — GenLayer unavailable', { service: 'genlayer', failures: _consecutiveFailures });
    }
}

/** Reset circuit breaker (for tests). */
export function _resetGLCircuit() {
    _consecutiveFailures = 0;
    _circuitTrippedAt = 0;
}

/**
 * Get or initialize the GenLayer SDK client (singleton).
 * REQUIRED — throws if GenLayer is not configured.
 * @returns {Promise<Object>} The GenLayer client.
 */
export async function getGenLayerClient() {
    if (_glClient) return _glClient;
    if (!GENLAYER_PRIVATE_KEY || !GENLAYER_CONTRACT_ADDRESS) {
        throw new Error('GenLayer not configured: GENLAYER_PRIVATE_KEY and GENLAYER_CONTRACT_ADDRESS are required');
    }
    try {
        const { createClient, createAccount } = await import('genlayer-js');
        const { testnetBradbury } = await import('genlayer-js/chains');
        const account = createAccount(GENLAYER_PRIVATE_KEY);
        _glClient = createClient({ chain: testnetBradbury, account });
        logger.info('SDK client initialized for Bradbury testnet', { service: 'genlayer', account: account.address });
        return _glClient;
    } catch (e) {
        logger.error('SDK init failed', { service: 'genlayer', error: e.message });
        throw e;
    }
}

/**
 * Submit a round's submissions to GenLayer for on-chain judging.
 * @param {import('./types.js').Submission[]} submissions
 * @param {string} jokePrompt
 * @param {string} category
 * @param {string} gameId
 * @returns {Promise<import('./types.js').GenLayerSubmitResult|null>}
 */
export async function submitToGenLayer(submissions, jokePrompt, category, gameId) {
    if (!isGenLayerAvailable()) {
        logger.warn('Circuit breaker open, skipping submission', { service: 'genlayer' });
        return null;
    }

    try {
        const client = await getGenLayerClient();

        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        logger.info('Submitting judge_round', { service: 'genlayer', gameId, submissions: submissions.length });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'judge_round',
            args: [gameId, jokePrompt, category, submissionsJson],
            value: 0n,
        });

        logger.info('judge_round submitted to OD', { service: 'genlayer', txHash, gameId });
        _recordSuccess();
        return { txHash, onChain: true };
    } catch (error) {
        logger.error('judge_round failed', { service: 'genlayer', error: error.message });
        _recordFailure();
        return null;
    }
}

/**
 * Poll GenLayer for a transaction result (winner ID).
 * @param {string} txHash
 * @param {number} [timeoutMs]
 * @returns {Promise<{winnerId: number, commentary: object|null}|null>} Winner + commentary, or null on timeout/failure.
 */
export async function pollGenLayerResult(txHash, timeoutMs = GL_POLL_TIMEOUT) {
    if (!txHash) return null;

    try {
        const client = await getGenLayerClient();
        const retries = Math.ceil(timeoutMs / 3000);
        const receipt = await client.waitForTransactionReceipt({
            hash: txHash,
            status: 'ACCEPTED',
            interval: 3000,
            retries,
        });

        if (!receipt?.data) {
            logger.warn('Poll receipt has no data', { service: 'genlayer', txHash });
            return null;
        }

        // Extract winnerId — supports both object and scalar forms
        const winnerId = typeof receipt.data === 'object'
            ? receipt.data.winner_id
            : parseInt(String(receipt.data));
        if (typeof winnerId !== 'number' || isNaN(winnerId) || winnerId <= 0) {
            logger.warn('Poll returned invalid winnerId', { service: 'genlayer', winnerId, rawReceipt: JSON.stringify(receipt.data) });
            return null;
        }

        // Extract commentary if present (from two-block judging)
        const commentary = (typeof receipt.data === 'object' && receipt.data.commentary) || null;

        logger.info('Poll result', { service: 'genlayer', winnerId, hasCommentary: !!commentary });
        _recordSuccess();
        return { winnerId, commentary };
    } catch (e) {
        logger.info('Poll timed out or failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return null;
    }
}

/**
 * Submit an appeal to GenLayer for re-judging a round.
 * @param {string} gameId
 * @param {string} jokePrompt
 * @param {string} category
 * @param {import('./types.js').Submission[]} submissions
 * @param {number} originalWinnerId
 * @returns {Promise<import('./types.js').GenLayerSubmitResult|null>}
 */
export async function appealWithGenLayer(gameId, jokePrompt, category, submissions, originalWinnerId) {
    if (!isGenLayerAvailable()) {
        logger.warn('Circuit breaker open, skipping appeal', { service: 'genlayer' });
        return null;
    }

    try {
        const client = await getGenLayerClient();

        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        logger.info('Submitting appeal_judgment', { service: 'genlayer', gameId });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'appeal_judgment',
            args: [gameId, jokePrompt, category, submissionsJson, originalWinnerId],
            value: 0n,
        });

        logger.info('appeal_judgment submitted to OD', { service: 'genlayer', txHash });
        _recordSuccess();
        return { txHash, onChain: true };
    } catch (error) {
        logger.error('appeal_judgment failed', { service: 'genlayer', error: error.message });
        _recordFailure();
        return null;
    }
}

/**
 * Register a new game on-chain (fire-and-forget).
 * @param {string} gameId
 * @param {string} host
 * @param {string} category
 * @param {number} numRounds
 * @param {Array<{name: string}>} players
 * @returns {Promise<{txHash: string}|null>}
 */
export async function createGameOnChain(gameId, host, category, numRounds, players) {
    try {
        const client = await getGenLayerClient();
        const playersJson = JSON.stringify(players.map(p => p.name || p));

        logger.info('Submitting create_game', { service: 'genlayer', gameId });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'create_game',
            args: [gameId, host, category, numRounds, playersJson],
            value: 0n,
        });

        logger.info('create_game submitted', { service: 'genlayer', txHash, gameId });
        return { txHash };
    } catch (error) {
        logger.error('create_game failed', { service: 'genlayer', error: error.message });
        return null;
    }
}

/**
 * Register a round's submissions on-chain (fire-and-forget).
 * @param {string} gameId
 * @param {number} roundNum
 * @param {string} jokeSetup
 * @param {import('./types.js').Submission[]} submissions
 * @returns {Promise<{txHash: string}|null>}
 */
export async function registerRoundOnChain(gameId, roundNum, jokeSetup, submissions) {
    try {
        const client = await getGenLayerClient();
        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        logger.info('Submitting register_round', { service: 'genlayer', gameId, roundNum });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'register_round',
            args: [gameId, roundNum, jokeSetup, submissionsJson],
            value: 0n,
        });

        logger.info('register_round submitted', { service: 'genlayer', txHash, gameId, roundNum });
        return { txHash };
    } catch (error) {
        logger.error('register_round failed', { service: 'genlayer', error: error.message });
        return null;
    }
}

/**
 * Record a round result on-chain (fire-and-forget).
 * @param {string} gameId
 * @param {number} roundNum
 * @param {number} winnerId
 * @param {string} winnerName
 * @param {Object} scores
 * @param {string} judgingMethod
 * @returns {Promise<{txHash: string}|null>}
 */
export async function recordResultOnChain(gameId, roundNum, winnerId, winnerName, scores, judgingMethod) {
    try {
        const client = await getGenLayerClient();
        const scoresJson = JSON.stringify(scores);

        logger.info('Submitting record_result', { service: 'genlayer', gameId, roundNum, winnerId });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'record_result',
            args: [gameId, roundNum, winnerId, winnerName, scoresJson, judgingMethod],
            value: 0n,
        });

        logger.info('record_result submitted', { service: 'genlayer', txHash, gameId, roundNum });
        return { txHash };
    } catch (error) {
        logger.error('record_result failed', { service: 'genlayer', error: error.message });
        return null;
    }
}

/**
 * Finalize a game on-chain (fire-and-forget).
 * @param {string} gameId
 * @param {string} winnerName
 * @param {Array<{name: string, score: number}>} finalStandings
 * @returns {Promise<{txHash: string}|null>}
 */
export async function finalizeGameOnChain(gameId, winnerName, finalStandings) {
    try {
        const client = await getGenLayerClient();
        const standingsJson = JSON.stringify(finalStandings.map(p => ({
            name: p.name,
            score: p.score,
            isBot: !!p.isBot
        })));

        logger.info('Submitting finalize_game', { service: 'genlayer', gameId, winnerName });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'finalize_game',
            args: [gameId, winnerName, standingsJson],
            value: 0n,
        });

        logger.info('finalize_game submitted', { service: 'genlayer', txHash, gameId });
        return { txHash };
    } catch (error) {
        logger.error('finalize_game failed', { service: 'genlayer', error: error.message });
        return null;
    }
}

/**
 * Read game state from GenLayer contract.
 * @param {string} gameId
 * @returns {Promise<Object|null>}
 */
export async function readGameOnChain(gameId) {
    try {
        const client = await getGenLayerClient();
        const result = await client.readContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'get_game',
            args: [gameId],
        });
        return result;
    } catch (e) {
        logger.warn('readGameOnChain failed', { service: 'genlayer', error: e.message });
        return null;
    }
}

/**
 * Read game stats from GenLayer contract.
 * @returns {Promise<Object|null>} Stats object, or null on failure.
 */
export async function readStats() {
    try {
        const client = await getGenLayerClient();
        const result = await client.readContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'get_stats',
            args: [],
        });
        return result;
    } catch (e) {
        logger.warn('readStats failed', { service: 'genlayer', error: e.message });
        return null;
    }
}

/**
 * Post game results to the Discord webhook.
 * @param {import('./types.js').Room} room
 * @returns {Promise<void>}
 */
export async function postGameToDiscord(room) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        const standings = [...room.players].sort((a, b) => b.score - a.score);
        const winner = standings[0];
        const podium = standings.slice(0, 3).map((p, i) => {
            const medal = ['\u{1F947}', '\u{1F948}', '\u{1F949}'][i];
            return `${medal} **${p.name}** \u2014 ${p.score} XP`;
        }).join('\n');

        const lastResult = (room.roundResults || []).at(-1);
        const winningJoke = lastResult
            ? `> *"${lastResult.winningPunchline || 'N/A'}"* \u2014 ${lastResult.winnerName || 'Unknown'}`
            : '';

        const embed = {
            title: '\u{1F3AD} Oracle of Wit \u2014 Game Over!',
            description: `**${winner.name}** wins the ${room.category} game!\n\n${podium}`,
            color: 0xA855F7,
            fields: [
                { name: 'Category', value: room.category, inline: true },
                { name: 'Rounds', value: `${room.totalRounds}`, inline: true },
                { name: 'Players', value: `${room.players.length}`, inline: true },
            ],
            footer: { text: 'Powered by GenLayer Optimistic Democracy' },
            timestamp: new Date().toISOString(),
        };

        if (winningJoke) {
            embed.fields.push({ name: 'Last Winning Joke', value: winningJoke });
        }

        const discordController = new AbortController();
        const discordTimeout = setTimeout(() => discordController.abort(), 5000);
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: discordController.signal,
            body: JSON.stringify({ username: 'Oracle of Wit', embeds: [embed] }),
        });
        clearTimeout(discordTimeout);
        logger.info('Game results posted', { service: 'discord' });
    } catch (err) {
        logger.error('Webhook failed', { service: 'discord', error: err.message });
    }
}
