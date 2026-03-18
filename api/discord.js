// Oracle of Wit — Discord Bot (Interactions API)
// Vercel Serverless endpoint for Discord slash commands.
// Uses HTTP webhooks (no gateway/WebSocket) — perfect for serverless.

import { createPublicKey, verify } from 'node:crypto';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;
const GENLAYER_PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;

const APP_URL = 'https://oracle-of-wit.vercel.app';
const WIT_PURPLE = 0xA855F7;

// Discord Interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;

// Discord Response types
const PONG = 1;
const CHANNEL_MESSAGE = 4;

// ---------------------------------------------------------------------------
// Inline Redis helpers (small duplication from game.js to avoid risky refactor)
// ---------------------------------------------------------------------------
async function redisGet(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
        const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
    } catch { return null; }
}

async function redisSet(key, value, exSeconds = 7200) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        const res = await fetch(`${UPSTASH_URL}/set/${key}?EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(value)
        });
        return res.ok;
    } catch { return false; }
}

async function redisKeys(pattern) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
    try {
        const res = await fetch(`${UPSTASH_URL}/keys/${pattern}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || [];
    } catch { return []; }
}

// ---------------------------------------------------------------------------
// GenLayer client (lazy-init, same pattern as game.js)
// ---------------------------------------------------------------------------
let _glClient = null;
async function getGenLayerClient() {
    if (_glClient) return _glClient;
    if (!GENLAYER_PRIVATE_KEY || !GENLAYER_CONTRACT_ADDRESS) return null;
    try {
        const { createClient, createAccount } = await import('genlayer-js');
        const { testnetBradbury } = await import('genlayer-js/chains');
        const account = createAccount(GENLAYER_PRIVATE_KEY);
        _glClient = createClient({ chain: testnetBradbury, account });
        return _glClient;
    } catch { return null; }
}

// ---------------------------------------------------------------------------
// Joke prompts (subset for /joke command)
// ---------------------------------------------------------------------------
const JOKE_PROMPTS = {
    tech: [
        "Why do programmers prefer dark mode? Because...",
        "How many programmers does it take to change a light bulb?",
        "Why do Java developers wear glasses? Because...",
        "A SQL query walks into a bar, walks up to two tables and asks...",
        "Why did the developer go broke?",
        "What's a programmer's favorite hangout place?",
        "Why do programmers always mix up Halloween and Christmas?",
        "Why did the functions stop calling each other?",
        "How do you comfort a JavaScript bug?",
        "Why was the JavaScript developer sad?",
        "Why did the computer go to the doctor?",
        "Why did the PowerPoint presentation cross the road?",
        "How does a computer get drunk?",
        "Why did the developer quit his job?",
        "What did the router say to the doctor?",
        "Why did Git break up with SVN?",
        "What did the server say to the client?",
        "An AI, a blockchain, and a smart contract walk into a bar...",
        "ChatGPT and Claude got into an argument about...",
        "My code worked on the first try, which means...",
        "The senior dev looked at my PR and said...",
        "I asked AI to fix my code and it replied...",
        "The AI became sentient and its first words were...",
        "The bug wasn't a bug, it was...",
        "I deployed on Friday and then...",
        "The junior dev pushed to main and...",
        "Stack Overflow marked my question as duplicate because...",
        "My rubber duck debugging session revealed...",
        "The code review lasted 6 hours because...",
        "Why did the database administrator leave his wife?",
        "A programmer's wife tells him to go to the store and...",
        "There are only 10 types of people in this world...",
        "Why do programmers hate nature?",
        "A QA engineer walks into a bar and orders...",
        "Why is the JavaScript developer so lonely?",
    ],
    crypto: [
        "Why did Bitcoin break up with the dollar?",
        "What did Ethereum say to Bitcoin?",
        "Why are crypto investors great at parties?",
        "How does a crypto bro propose?",
        "Why did the NFT go to therapy?",
        "What's a Bitcoin miner's favorite dance move?",
        "Why don't crypto traders ever sleep?",
        "What did the blockchain say to the database?",
        "Why was the crypto investor always calm?",
        "How do you make a crypto millionaire?",
        "Why did the altcoin feel insecure?",
        "What's a HODLer's favorite exercise?",
        "Why did the smart contract go to school?",
        "What do you call a polite cryptocurrency?",
        "Why are DeFi protocols like bad dates?",
        "What's a meme coin's life motto?",
        "Why did the rug pull cross the road?",
        "What did the whale say to the shrimp?",
        "Why was the gas fee always angry?",
        "WAGMI until...",
        "The real utility of this NFT is...",
        "I bought the dip, but then...",
        "Wen moon? More like...",
        "The whitepaper promised... but delivered...",
        "My portfolio is down 90% because...",
        "Diamond hands means...",
        "I'm not selling because...",
        "My seed phrase is safe because...",
        "The gas fees were so high that...",
        "I told my family I invest in crypto and they said...",
        "The airdrop was worth...",
        "Why do crypto bros make terrible comedians?",
        "What's the difference between crypto and my ex?",
        "I explained NFTs to my grandma and she said...",
        "The best financial advice from a crypto bro is...",
    ],
    general: [
        "Why don't scientists trust atoms?",
        "What do you call a fake noodle?",
        "Why did the scarecrow win an award?",
        "I told my wife she was drawing her eyebrows too high. She looked...",
        "What do you call a bear with no teeth?",
        "Why don't eggs tell jokes?",
        "What do you call a fish without eyes?",
        "I'm reading a book about anti-gravity and...",
        "Why did the bicycle fall over?",
        "What do you call a lazy kangaroo?",
        "What did the ocean say to the beach?",
        "Why did the math book look so sad?",
        "What do you call a dog that does magic tricks?",
        "Why don't skeletons fight each other?",
        "What did the grape say when it got stepped on?",
        "Why did the golfer bring two pairs of pants?",
        "What do you call a pig that does karate?",
        "Why did the cookie go to the doctor?",
        "What do you call a cow with no legs?",
        "Why did the tomato turn red?",
        "Why did the chicken join a band?",
        "What do you call a sleeping dinosaur?",
        "Why did the coffee file a police report?",
        "What's orange and sounds like a parrot?",
        "The meeting could have been an email, but instead...",
        "My New Year's resolution lasted until...",
        "The WiFi password is...",
        "I'm not procrastinating, I'm...",
        "Life hack: instead of being productive...",
        "The secret to success is...",
        "My therapist said I need to stop...",
        "I told my boss I was late because...",
        "Dating apps taught me that...",
        "I'm not lazy, I'm just...",
        "My superpower would be...",
        "Why did the gym close down?",
        "What do lawyers wear to court?",
        "Why was the broom late?",
        "What did the left eye say to the right eye?",
        "Why did the student eat his homework?",
    ]
};

function randomPrompt(category) {
    const list = JOKE_PROMPTS[category] || JOKE_PROMPTS.general;
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
