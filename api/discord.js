// Oracle of Wit — Discord Bot (Interactions API)
// Vercel Serverless endpoint for Discord slash commands.
// Uses HTTP webhooks (no gateway/WebSocket) — perfect for serverless.

import { createPublicKey, verify } from 'node:crypto';
import { redisGet, redisSet, redisKeys } from './lib/redis.js';
import { getGenLayerClient } from './lib/genlayer.js';
import { CATEGORIZED_PROMPTS } from './lib/constants.js';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;

const APP_URL = 'https://oracle-of-wit.vercel.app';
const WIT_PURPLE = 0xA855F7;

// Discord Interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;

// Discord Response types
const PONG = 1;
const CHANNEL_MESSAGE = 4;

// ---------------------------------------------------------------------------
// Joke prompts — derived from canonical PROMPT_PUNCHLINES source
// ---------------------------------------------------------------------------
function randomPrompt(category) {
    const list = CATEGORIZED_PROMPTS[category] || CATEGORIZED_PROMPTS.general;
    return list[Math.floor(Math.random() * list.length)];
}

// ---------------------------------------------------------------------------
// Room creation (mirrors game.js room structure)
// ---------------------------------------------------------------------------
function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createRoom(hostName, category) {
    const roomId = generateRoomCode();
    const room = {
        id: roomId,
        host: hostName,
        category: category || 'tech',
        maxPlayers: 100,
        players: [{ name: hostName, score: 0, isHost: true, isBot: false, joinedAt: Date.now() }],
        spectators: [],
        status: 'waiting',
        currentRound: 0,
        totalRounds: 5,
        jokePrompt: '',
        submissions: [],
        bets: [],
        reactions: [],
        roundResults: [],
        usedPrompts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        phaseEndsAt: null,
        isSinglePlayer: false,
        weeklyTheme: null,
        version: 0
    };
    await redisSet(`room:${roomId}`, room);
    return { roomId, room };
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

function embed(title, description, fields = [], footer) {
    const obj = { title, description, color: WIT_PURPLE };
    if (fields.length) obj.fields = fields;
    if (footer) obj.footer = { text: footer };
    obj.timestamp = new Date().toISOString();
    return obj;
}

async function handlePlay(options) {
    const categoryOpt = options?.find(o => o.name === 'category');
    const category = categoryOpt?.value || 'tech';
    const { roomId } = await createRoom('Discord Player', category);

    return {
        type: CHANNEL_MESSAGE,
        data: {
            embeds: [embed(
                'New Game Room Created!',
                `Category: **${category}**\nRoom Code: \`${roomId}\``,
                [
                    { name: 'Join Link', value: `[Play Now](${APP_URL}?room=${roomId})`, inline: true },
                    { name: 'Room Code', value: `\`${roomId}\``, inline: true },
                ],
                'Share the room code with friends!'
            )]
        }
    };
}

async function handleLeaderboard() {
    const leaderboard = await redisGet('leaderboard') || [];
    const top10 = leaderboard.slice(0, 10);

    if (!top10.length) {
        return {
            type: CHANNEL_MESSAGE,
            data: {
                embeds: [embed(
                    'Leaderboard',
                    'No players ranked yet. Be the first!',
                    [],
                    'Play at oracle-of-wit.vercel.app'
                )]
            }
        };
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = top10.map((p, i) => {
        const prefix = i < 3 ? medals[i] : `**${i + 1}.**`;
        const name = p.name || p.playerName || 'Unknown';
        const score = p.totalScore ?? p.score ?? 0;
        return `${prefix} **${name}** — ${score} XP`;
    });

    return {
        type: CHANNEL_MESSAGE,
        data: {
            embeds: [embed(
                'Top 10 Players',
                lines.join('\n'),
                [],
                'Powered by GenLayer Optimistic Democracy'
            )]
        }
    };
}

async function handleStats(options) {
    const playerOpt = options?.find(o => o.name === 'player');
    const playerName = playerOpt?.value;

    if (playerName) {
        // Player-specific stats
        const leaderboard = await redisGet('leaderboard') || [];
        const entry = leaderboard.find(p => (p.name || p.playerName) === playerName);

        if (!entry) {
            return {
                type: CHANNEL_MESSAGE,
                data: {
                    embeds: [embed(
                        `Stats: ${playerName}`,
                        'Player not found on the leaderboard.',
                        [],
                        'Play at oracle-of-wit.vercel.app'
                    )]
                }
            };
        }

        const rank = leaderboard.indexOf(entry) + 1;
        return {
            type: CHANNEL_MESSAGE,
            data: {
                embeds: [embed(
                    `Stats: ${playerName}`,
                    `Rank **#${rank}** on the leaderboard`,
                    [
                        { name: 'Total XP', value: `${entry.totalScore ?? entry.score ?? 0}`, inline: true },
                        { name: 'Games Played', value: `${entry.gamesPlayed ?? 0}`, inline: true },
                        { name: 'Wins', value: `${entry.wins ?? 0}`, inline: true },
                    ],
                    'Powered by GenLayer Optimistic Democracy'
                )]
            }
        };
    }

    // Global stats
    const leaderboard = await redisGet('leaderboard') || [];
    const roomKeys = await redisKeys('room:*');

    return {
        type: CHANNEL_MESSAGE,
        data: {
            embeds: [embed(
                'Oracle of Wit — Global Stats',
                'Game-wide statistics',
                [
                    { name: 'Total Players', value: `${leaderboard.length}`, inline: true },
                    { name: 'Active Rooms', value: `${roomKeys.length}`, inline: true },
                    { name: 'Top Player', value: leaderboard[0] ? `**${leaderboard[0].name || leaderboard[0].playerName}**` : 'N/A', inline: true },
                ],
                'Play at oracle-of-wit.vercel.app'
            )]
        }
    };
}

async function handleJoke(options) {
    const categoryOpt = options?.find(o => o.name === 'category');
    const category = categoryOpt?.value || 'general';
    const setup = randomPrompt(category);

    return {
        type: CHANNEL_MESSAGE,
        data: {
            content: `**Joke Setup** (${category}):\n> ${setup}\n\n*Think you can finish it? Play at ${APP_URL}!*`,
            flags: 64 // Ephemeral — only the caller sees it
        }
    };
}

async function handleHistory(options) {
    const playerOpt = options?.find(o => o.name === 'player');
    const playerName = playerOpt?.value;

    if (!playerName) {
        return {
            type: CHANNEL_MESSAGE,
            data: {
                embeds: [embed('Player History', 'Please provide a player name.')]
            }
        };
    }

    // Try GenLayer first
    const client = await getGenLayerClient();
    if (client) {
        try {
            const history = await client.readContract({
                address: GENLAYER_CONTRACT_ADDRESS,
                functionName: 'get_player_history',
                args: [playerName],
            });
            if (history) {
                const games = history.games || [];
                const gameLines = games.slice(0, 5).map((g, i) =>
                    `${i + 1}. **${g.category || 'N/A'}** — ${g.score ?? 0} XP`
                );
                return {
                    type: CHANNEL_MESSAGE,
                    data: {
                        embeds: [embed(
                            `On-Chain History: ${playerName}`,
                            `Source: **GenLayer** (Testnet Bradbury)`,
                            [
                                { name: 'Total Score', value: `${history.total_score ?? 0} XP`, inline: true },
                                { name: 'Games Played', value: `${history.games_played ?? 0}`, inline: true },
                                { name: 'Recent Games', value: gameLines.length ? gameLines.join('\n') : 'No games recorded yet' },
                            ],
                            'Verified on GenLayer Optimistic Democracy'
                        )]
                    }
                };
            }
        } catch {
            // Fall through to Redis
        }
    }

    // Redis fallback
    const leaderboard = await redisGet('leaderboard') || [];
    const entry = leaderboard.find(p => (p.name || p.playerName) === playerName);

    return {
        type: CHANNEL_MESSAGE,
        data: {
            embeds: [embed(
                `Player History: ${playerName}`,
                entry ? `Source: **Redis** (off-chain)` : 'Player not found.',
                entry ? [
                    { name: 'Total Score', value: `${entry.totalScore ?? entry.score ?? 0} XP`, inline: true },
                    { name: 'Games Played', value: `${entry.gamesPlayed ?? 0}`, inline: true },
                ] : [],
                entry ? 'GenLayer unavailable — showing cached data' : 'Play at oracle-of-wit.vercel.app'
            )]
        }
    };
}

// ---------------------------------------------------------------------------
// Ed25519 signature verification using Node.js built-in crypto (sync, no deps)
// ---------------------------------------------------------------------------
function verifyDiscordSignature(rawBody, signature, timestamp, publicKeyHex) {
    try {
        const msg = Buffer.from(timestamp + rawBody);
        const sig = Buffer.from(signature, 'hex');
        // Wrap raw Ed25519 public key bytes in DER/SPKI envelope
        const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
        const keyBytes = Buffer.from(publicKeyHex, 'hex');
        const key = createPublicKey({ key: Buffer.concat([derPrefix, keyBytes]), format: 'der', type: 'spki' });
        return verify(null, msg, key, sig);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Vercel provides req.body as parsed JSON by default.
    // Re-serialize to get the raw string for Ed25519 verification.
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];

    if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) {
        return res.status(401).json({ error: 'Invalid request signature' });
    }

    const isValid = verifyDiscordSignature(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid request signature' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // PING → PONG (Discord endpoint verification)
    if (body.type === PING) {
        return res.status(200).json({ type: PONG });
    }

    // Slash commands
    if (body.type === APPLICATION_COMMAND) {
        const { name, options } = body.data;

        let response;
        switch (name) {
            case 'play':
                response = await handlePlay(options);
                break;
            case 'leaderboard':
                response = await handleLeaderboard();
                break;
            case 'stats':
                response = await handleStats(options);
                break;
            case 'joke':
                response = await handleJoke(options);
                break;
            case 'history':
                response = await handleHistory(options);
                break;
            default:
                response = {
                    type: CHANNEL_MESSAGE,
                    data: { content: `Unknown command: ${name}`, flags: 64 }
                };
        }

        return res.status(200).json(response);
    }

    return res.status(400).json({ error: 'Unknown interaction type' });
}
