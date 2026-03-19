// GenLayer SDK integration — Testnet Bradbury

import { logger } from './logger.js';

const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;
const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

let _glClient = null;
let _lastGLSubmit = 0;
const GL_COOLDOWN = parseInt(process.env.GL_COOLDOWN) || 15000;
const GL_POLL_TIMEOUT = parseInt(process.env.GL_POLL_TIMEOUT) || 30000;

/**
 * Get or initialize the GenLayer SDK client (singleton).
 * @returns {Promise<Object|null>} The GenLayer client, or null if not configured.
 */
export async function getGenLayerClient() {
    if (_glClient) return _glClient;
    if (!GENLAYER_PRIVATE_KEY || !GENLAYER_CONTRACT_ADDRESS) return null;
    try {
        const { createClient, createAccount } = await import('genlayer-js');
        const { testnetBradbury } = await import('genlayer-js/chains');
        const account = createAccount(GENLAYER_PRIVATE_KEY);
        _glClient = createClient({ chain: testnetBradbury, account });
        logger.info('SDK client initialized for Bradbury testnet', { service: 'genlayer', account: account.address });
        return _glClient;
    } catch (e) {
        logger.error('SDK init failed', { service: 'genlayer', error: e.message });
        return null;
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
    const client = await getGenLayerClient();
    if (!client) {
        logger.info('Not configured (missing key or address)', { service: 'genlayer' });
        return null;
    }

    const now = Date.now();
    if (now - _lastGLSubmit < GL_COOLDOWN) {
        logger.info('Cooldown active, skipping', { service: 'genlayer', msSinceLast: now - _lastGLSubmit });
        return null;
    }

    try {
        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        logger.info('Submitting judge_round', { service: 'genlayer', gameId, submissions: submissions.length });
        _lastGLSubmit = now;

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'judge_round',
            args: [gameId, jokePrompt, category, submissionsJson],
            value: 0n,
        });

        logger.info('judge_round submitted to OD', { service: 'genlayer', txHash, gameId });
        return { txHash, onChain: true };
    } catch (error) {
        logger.error('judge_round failed', { service: 'genlayer', error: error.message });
        return null;
    }
}

/**
 * Poll GenLayer for a transaction result (winner ID).
 * @param {string} txHash
 * @param {number} [timeoutMs]
 * @returns {Promise<number|null>} The winning submission ID, or null on timeout/failure.
 */
export async function pollGenLayerResult(txHash, timeoutMs = GL_POLL_TIMEOUT) {
    const client = await getGenLayerClient();
    if (!client || !txHash) return null;

    try {
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

        const winnerId = typeof receipt.data === 'object'
            ? receipt.data.winner_id
            : parseInt(String(receipt.data));
        if (typeof winnerId !== 'number' || isNaN(winnerId) || winnerId <= 0) {
            logger.warn('Poll returned invalid winnerId', { service: 'genlayer', winnerId, rawReceipt: JSON.stringify(receipt.data) });
            return null;
        }
        logger.info('Poll result', { service: 'genlayer', winnerId });
        return winnerId;
    } catch (e) {
        logger.info('Poll timed out or failed', { service: 'genlayer', error: e.message });
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
    const client = await getGenLayerClient();
    if (!client) return false;

    try {
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
        return txHash;
    } catch (error) {
        logger.error('record_game_result failed', { service: 'genlayer', error: error.message });
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
    const client = await getGenLayerClient();
    if (!client) return false;

    try {
        logger.info('Creating game on-chain', { service: 'genlayer', gameId, hostName, category });

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'create_game',
            args: [gameId, hostName, category],
            value: 0n,
        });

        logger.info('create_game tx', { service: 'genlayer', txHash });
        return txHash;
    } catch (error) {
        logger.error('create_game failed', { service: 'genlayer', error: error.message });
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
    const client = await getGenLayerClient();
    if (!client) return null;

    try {
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
        return { txHash, onChain: true };
    } catch (error) {
        logger.error('appeal_judgment failed', { service: 'genlayer', error: error.message });
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
