// GenLayer SDK integration — Testnet Bradbury

const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;
const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

let _glClient = null;
let _lastGLSubmit = 0;
const GL_COOLDOWN = parseInt(process.env.GL_COOLDOWN) || 15000;
const GL_POLL_TIMEOUT = parseInt(process.env.GL_POLL_TIMEOUT) || 30000;

export async function getGenLayerClient() {
    if (_glClient) return _glClient;
    if (!GENLAYER_PRIVATE_KEY || !GENLAYER_CONTRACT_ADDRESS) return null;
    try {
        const { createClient, createAccount } = await import('genlayer-js');
        const { testnetBradbury } = await import('genlayer-js/chains');
        const account = createAccount(GENLAYER_PRIVATE_KEY);
        _glClient = createClient({ chain: testnetBradbury, account });
        console.log('[GenLayer] SDK client initialized for Bradbury testnet, account:', account.address);
        return _glClient;
    } catch (e) {
        console.error('[GenLayer] SDK init failed:', e.message);
        return null;
    }
}

export async function submitToGenLayer(submissions, jokePrompt, category, gameId) {
    const client = await getGenLayerClient();
    if (!client) {
        console.log('[GenLayer] Not configured (missing key or address)');
        return null;
    }

    const now = Date.now();
    if (now - _lastGLSubmit < GL_COOLDOWN) {
        console.log('[GenLayer] Cooldown active, skipping (last submit was', now - _lastGLSubmit, 'ms ago)');
        return null;
    }

    try {
        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        console.log(`[GenLayer] Submitting judge_round for ${gameId} (${submissions.length} submissions)`);
        _lastGLSubmit = now;

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'judge_round',
            args: [gameId, jokePrompt, category, submissionsJson],
            value: 0n,
        });

        console.log(`[GenLayer] judge_round submitted to OD: ${txHash} (game: ${gameId})`);
        return { txHash, onChain: true };
    } catch (error) {
        console.error('[GenLayer] judge_round failed:', error.message);
        return null;
    }
}

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
            console.warn(`[GenLayer] Poll receipt has no data (tx: ${txHash})`);
            return null;
        }

        const winnerId = typeof receipt.data === 'object'
            ? receipt.data.winner_id
            : parseInt(String(receipt.data));
        if (typeof winnerId !== 'number' || isNaN(winnerId) || winnerId <= 0) {
            console.warn(`[GenLayer] Poll returned invalid winnerId: ${winnerId}, raw receipt:`, JSON.stringify(receipt.data));
            return null;
        }
        console.log(`[GenLayer] Poll result: winner_id=${winnerId}`);
        return winnerId;
    } catch (e) {
        console.log(`[GenLayer] Poll timed out or failed: ${e.message}`);
        return null;
    }
}

export async function recordOnChain(gameId, finalScores) {
    const client = await getGenLayerClient();
    if (!client) return false;

    try {
        const scoresJson = JSON.stringify(finalScores.map(p => ({
            playerName: p.name,
            score: p.score
        })));

        console.log(`[GenLayer] Recording game ${gameId} results on-chain`);

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'record_game_result',
            args: [gameId, scoresJson],
            value: 0n,
        });

        console.log(`[GenLayer] record_game_result tx: ${txHash}`);
        return txHash;
    } catch (error) {
        console.error('[GenLayer] record_game_result failed:', error.message);
        return false;
    }
}

export async function createGameOnChain(gameId, hostName, category) {
    const client = await getGenLayerClient();
    if (!client) return false;

    try {
        console.log(`[GenLayer] Creating game ${gameId} on-chain (host: ${hostName}, category: ${category})`);

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'create_game',
            args: [gameId, hostName, category],
            value: 0n,
        });

        console.log(`[GenLayer] create_game tx: ${txHash}`);
        return txHash;
    } catch (error) {
        console.error('[GenLayer] create_game failed:', error.message);
        return false;
    }
}

export async function appealWithGenLayer(gameId, jokePrompt, category, submissions, originalWinnerId) {
    const client = await getGenLayerClient();
    if (!client) return null;

    try {
        const submissionsJson = JSON.stringify(submissions.map(s => ({
            id: s.id,
            playerName: s.playerName,
            punchline: s.punchline
        })));

        console.log(`[GenLayer] Submitting appeal_judgment for ${gameId}`);

        const txHash = await client.writeContract({
            address: GENLAYER_CONTRACT_ADDRESS,
            functionName: 'appeal_judgment',
            args: [gameId, jokePrompt, category, submissionsJson, originalWinnerId],
            value: 0n,
        });

        console.log(`[GenLayer] appeal_judgment submitted to OD: ${txHash}`);
        return { txHash, onChain: true };
    } catch (error) {
        console.error('[GenLayer] appeal_judgment failed:', error.message);
        return null;
    }
}

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
        console.log('[Discord] Game results posted');
    } catch (err) {
        console.error('[Discord] Webhook failed:', err.message);
    }
}
