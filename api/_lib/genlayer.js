// GenLayer SDK integration — Testnet Bradbury
// GenLayer is the PRIMARY backbone of Oracle of Wit.
// All judging goes through Optimistic Democracy on-chain.

import { logger } from './logger.js';

const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;
const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

let _glClient = null;
const GL_POLL_TIMEOUT = parseInt(process.env.GL_POLL_TIMEOUT) || 30000;

// --- Circuit breaker ---
// Trips after 3 consecutive failures, auto-resets after 60s.
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
 * Record final game scores on-chain via GenLayer.
 * @param {string} gameId
 * @param {import('./types.js').Player[]} finalScores
 * @returns {Promise<string|false>} The transaction hash, or false on failure.
 */
export async function recordOnChain(gameId, finalScores) {
    if (!isGenLayerAvailable()) {
        logger.warn('Circuit breaker open, skipping record', { service: 'genlayer' });
        return false;
    }

    try {
        const client = await getGenLayerClient();

        const scoresJson = JSON.stringify(finalScores.map(p => ({
            playerName: p.name,
            score: p.score
        })));

        logger.info('Recording game results on-chain', { service: 'genlayer', gameId });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'record_game_result',
            args: [gameId, scoresJson],
            value: 0n,
        });

        logger.info('record_game_result tx', { service: 'genlayer', txHash });
        _recordSuccess();
        return txHash;
    } catch (error) {
        logger.error('record_game_result failed', { service: 'genlayer', error: error.message });
        _recordFailure();
        return false;
    }
}

/**
 * Create a new game on-chain via GenLayer.
 * @param {string} gameId
 * @param {string} hostName
 * @param {string} category
 * @returns {Promise<string|false>} The transaction hash, or false on failure.
 */
export async function createGameOnChain(gameId, hostName, category) {
    if (!isGenLayerAvailable()) {
        logger.warn('Circuit breaker open, skipping create_game', { service: 'genlayer' });
        return false;
    }

    try {
        const client = await getGenLayerClient();

        logger.info('Creating game on-chain', { service: 'genlayer', gameId, hostName, category });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'create_game',
            args: [gameId, hostName, category],
            value: 0n,
        });

        logger.info('create_game tx', { service: 'genlayer', txHash });
        _recordSuccess();
        return txHash;
    } catch (error) {
        logger.error('create_game failed', { service: 'genlayer', error: error.message });
        _recordFailure();
        return false;
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
 * Read leaderboard from GenLayer contract.
 * @param {number} [limit=20]
 * @returns {Promise<Array|null>} Leaderboard data, or null on failure.
 */
export async function readLeaderboard(limit = 20) {
    if (!isGenLayerAvailable()) return null;

    try {
        const client = await getGenLayerClient();
        const result = await client.readContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'get_leaderboard',
            args: [limit],
        });
        _recordSuccess();
        return result;
    } catch (e) {
        logger.warn('readLeaderboard failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return null;
    }
}

/**
 * Read game stats from GenLayer contract.
 * @returns {Promise<Object|null>} Stats object, or null on failure.
 */
export async function readStats() {
    if (!isGenLayerAvailable()) return null;

    try {
        const client = await getGenLayerClient();
        const result = await client.readContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'get_stats',
            args: [],
        });
        _recordSuccess();
        return result;
    } catch (e) {
        logger.warn('readStats failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return null;
    }
}

// ---------------------------------------------------------------------------
// New wrappers for native GenLayer migration
// ---------------------------------------------------------------------------

/**
 * Read a player profile from the GenLayer contract.
 * @param {string} playerId
 * @returns {Promise<Object|null>} Parsed profile object, or null.
 */
export async function readProfile(playerId) {
    if (!isGenLayerAvailable()) return null;

    try {
        const client = await getGenLayerClient();
        const result = await client.readContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'get_profile',
            args: [playerId],
        });
        _recordSuccess();
        return result;
    } catch (e) {
        logger.warn('readProfile failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return null;
    }
}

/**
 * Write (upsert) a player profile to the GenLayer contract.
 * @param {string} playerId
 * @param {string} profileJson
 * @returns {Promise<string|false>} txHash or false on failure.
 */
export async function writeProfile(playerId, profileJson) {
    if (!isGenLayerAvailable()) return false;

    try {
        const client = await getGenLayerClient();
        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'update_profile',
            args: [playerId, profileJson],
            value: 0n,
        });
        logger.info('update_profile tx', { service: 'genlayer', txHash });
        _recordSuccess();
        return txHash;
    } catch (e) {
        logger.error('update_profile failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return false;
    }
}

/**
 * Record full game results (profiles + leaderboard + hall of fame) in one tx.
 * @param {string} gameId
 * @param {string} resultsJson
 * @returns {Promise<string|false>} txHash or false on failure.
 */
export async function recordGameFull(gameId, resultsJson) {
    if (!isGenLayerAvailable()) return false;

    try {
        const client = await getGenLayerClient();
        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'record_game',
            args: [gameId, resultsJson],
            value: 0n,
        });
        logger.info('record_game tx', { service: 'genlayer', txHash });
        _recordSuccess();
        return txHash;
    } catch (e) {
        logger.error('record_game failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return false;
    }
}

/**
 * Read the hall of fame from the GenLayer contract.
 * @param {number} [limit=50]
 * @returns {Promise<Array|null>}
 */
export async function readHallOfFame(limit = 50) {
    if (!isGenLayerAvailable()) return null;

    try {
        const client = await getGenLayerClient();
        const result = await client.readContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'get_hall_of_fame',
            args: [limit],
        });
        _recordSuccess();
        return result;
    } catch (e) {
        logger.warn('readHallOfFame failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return null;
    }
}

/**
 * Add a winning joke to the hall of fame on-chain.
 * @param {string} jokeJson
 * @returns {Promise<string|false>} txHash or false on failure.
 */
export async function writeHallOfFame(jokeJson) {
    if (!isGenLayerAvailable()) return false;

    try {
        const client = await getGenLayerClient();
        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'add_to_hall_of_fame',
            args: [jokeJson],
            value: 0n,
        });
        logger.info('add_to_hall_of_fame tx', { service: 'genlayer', txHash });
        _recordSuccess();
        return txHash;
    } catch (e) {
        logger.error('add_to_hall_of_fame failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return false;
    }
}

/**
 * Batch-generate prompts on-chain via GenLayer's gl.exec_prompt().
 * @param {string} category
 * @param {number} count
 * @returns {Promise<string|false>} txHash or false on failure.
 */
export async function generatePromptsOnChain(category, count) {
    if (!isGenLayerAvailable()) return false;

    try {
        const client = await getGenLayerClient();
        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'generate_prompts',
            args: [category, count],
            value: 0n,
        });
        logger.info('generate_prompts tx', { service: 'genlayer', txHash, category, count });
        _recordSuccess();
        return txHash;
    } catch (e) {
        logger.error('generate_prompts failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return false;
    }
}

/**
 * Pop a prompt from the on-chain prompt pool.
 * @param {string} category
 * @returns {Promise<string|false>} txHash or false on failure.
 */
export async function popPromptOnChain(category) {
    if (!isGenLayerAvailable()) return false;

    try {
        const client = await getGenLayerClient();
        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'pop_prompt',
            args: [category],
            value: 0n,
        });
        logger.info('pop_prompt tx', { service: 'genlayer', txHash, category });
        _recordSuccess();
        return txHash;
    } catch (e) {
        logger.error('pop_prompt failed', { service: 'genlayer', error: e.message });
        _recordFailure();
        return false;
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
