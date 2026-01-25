// Uses Upstash Redis for persistence across serverless calls
// Set up free account at upstash.com, then add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel env vars

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Redis helper functions
async function redisGet(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
        console.log('No Upstash credentials, using fallback');
        return null;
    }
    try {
        const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
    } catch (e) {
        console.error('Redis GET error:', e);
        return null;
    }
}

async function redisSet(key, value, exSeconds = 7200) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
        console.log('No Upstash credentials, using fallback');
        return false;
    }
    try {
        const res = await fetch(`${UPSTASH_URL}/set/${key}?EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(value)
        });
        return res.ok;
    } catch (e) {
        console.error('Redis SET error:', e);
        return false;
    }
}

async function redisDel(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        await fetch(`${UPSTASH_URL}/del/${key}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        return true;
    } catch (e) {
        return false;
    }
}

async function redisKeys(pattern) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
    try {
        const res = await fetch(`${UPSTASH_URL}/keys/${pattern}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || [];
    } catch (e) {
        return [];
    }
}

// In-memory fallback (for testing without Redis)
const fallbackRooms = {};
const fallbackLeaderboard = [];

async function getRoom(roomId) {
    const room = await redisGet(`room:${roomId}`);
    return room || fallbackRooms[roomId] || null;
}

async function setRoom(roomId, room) {
    fallbackRooms[roomId] = room;
    await redisSet(`room:${roomId}`, room);
}

async function getLeaderboard() {
    const lb = await redisGet('leaderboard');
    return lb || fallbackLeaderboard;
}

async function setLeaderboard(lb) {
    fallbackLeaderboard.length = 0;
    fallbackLeaderboard.push(...lb);
    await redisSet('leaderboard', lb);
}

// Helper functions
function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function now() {
    return Date.now();
}

function getPromptsForCategory(category) {
    const prompts = {
        tech: [
            "An AI, a blockchain, and a smart contract walk into a bar...",
            "Why did the developer quit? Because...",
            "The bug wasn't a bug, it was...",
            "ChatGPT and Claude got into an argument about...",
            "The validator rejected the transaction because...",
            "My code worked on the first try, which means...",
            "The senior dev looked at my PR and said...",
            "I asked AI to fix my code and it replied...",
            "The blockchain was congested because...",
            "Web3 will change the world when...",
            "The AI became sentient and its first words were...",
            "My smart contract had one bug, and now...",
            "The hackathon was going great until..."
        ],
        crypto: [
            "WAGMI until...",
            "The real utility of this NFT is...",
            "I bought the dip, but then...",
            "Wen moon? More like...",
            "The whitepaper promised..., but delivered...",
            "My portfolio is down 90% because...",
            "The rug pull happened when...",
            "Diamond hands means...",
            "I'm not selling because...",
            "The best time to buy was...",
            "My seed phrase is safe because...",
            "The gas fees were so high that...",
            "I told my family I invest in crypto and they said..."
        ],
        general: [
            "The meeting could have been an email, but instead...",
            "My New Year's resolution lasted until...",
            "The WiFi password is...",
            "I'm not procrastinating, I'm...",
            "Life hack: instead of being productive...",
            "The secret to success is...",
            "My therapist said I need to...",
            "The gym membership was worth it because...",
            "I told my boss I was late because...",
            "Dating apps taught me that...",
            "The fortune cookie said...",
            "I'm not lazy, I'm just...",
            "My superpower would be..."
        ]
    };
    return prompts[category] || prompts.general;
}

function pickWinner(submissions) {
    // Simple random for now - in production this would call GenLayer AI
    const randomIndex = Math.floor(Math.random() * submissions.length);
    return submissions[randomIndex].id;
}

async function updateLeaderboard(playerName, score) {
    const lb = await getLeaderboard();
    const existing = lb.find(p => p.name === playerName);
    if (existing) {
        existing.totalScore += score;
        existing.gamesPlayed++;
    } else {
        lb.push({
            name: playerName,
            totalScore: score,
            gamesPlayed: 1
        });
    }
    lb.sort((a, b) => b.totalScore - a.totalScore);
    await setLeaderboard(lb.slice(0, 100)); // Keep top 100
}

// Main handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;
    const body = req.body || {};

    try {
        switch (action) {
            case 'createRoom': {
                const { hostName, category, maxPlayers = 10 } = body;
                if (!hostName) {
                    return res.status(400).json({ error: 'hostName required' });
                }
                
                const roomId = generateRoomCode();
                const room = {
                    id: roomId,
                    host: hostName,
                    category: category || 'tech',
                    maxPlayers,
                    players: [{
                        name: hostName,
                        score: 0,
                        isHost: true,
                        joinedAt: now()
                    }],
                    status: 'waiting',
                    currentRound: 0,
                    totalRounds: 3,
                    jokePrompt: '',
                    submissions: [],
                    bets: [],
                    roundResults: [],
                    usedPrompts: [],
                    createdAt: now(),
                    updatedAt: now(),
                    phaseEndsAt: null
                };
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ 
                    success: true, 
                    roomId, 
                    room 
                });
            }

            case 'joinRoom': {
                const { roomId, playerName } = body;
                if (!roomId || !playerName) {
                    return res.status(400).json({ error: 'roomId and playerName required' });
                }
                
                const room = await getRoom(roomId);
                if (!room) {
                    return res.status(404).json({ error: 'Room not found. It may have expired.' });
                }
                
                if (room.status !== 'waiting') {
                    return res.status(400).json({ error: 'Game already started' });
                }
                
                if (room.players.length >= room.maxPlayers) {
                    return res.status(400).json({ error: 'Room is full' });
                }
                
                const existingPlayer = room.players.find(p => p.name === playerName);
                if (!existingPlayer) {
                    room.players.push({
                        name: playerName,
                        score: 0,
                        isHost: false,
                        joinedAt: now()
                    });
                    room.updatedAt = now();
                    await setRoom(roomId, room);
                }
                
                return res.status(200).json({ success: true, room });
            }

            case 'getRoom': {
                const roomId = req.query.roomId;
                if (!roomId) {
                    return res.status(400).json({ error: 'roomId required' });
                }
                
                const room = await getRoom(roomId);
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                return res.status(200).json({ success: true, room });
            }

            case 'listRooms': {
                const keys = await redisKeys('room:*');
                const publicRooms = [];
                
                for (const key of keys.slice(0, 20)) {
                    const roomId = key.replace('room:', '');
                    const room = await getRoom(roomId);
                    if (room && room.status === 'waiting') {
                        publicRooms.push({
                            id: room.id,
                            host: room.host,
                            category: room.category,
                            players: room.players.length,
                            maxPlayers: room.maxPlayers
                        });
                    }
                }
                
                // Also include fallback rooms
                for (const roomId in fallbackRooms) {
                    const room = fallbackRooms[roomId];
                    if (room && room.status === 'waiting' && !publicRooms.find(r => r.id === roomId)) {
                        publicRooms.push({
                            id: room.id,
                            host: room.host,
                            category: room.category,
                            players: room.players.length,
                            maxPlayers: room.maxPlayers
                        });
                    }
                }
                
                return res.status(200).json({ success: true, rooms: publicRooms });
            }

            case 'startGame': {
                const { roomId, hostName } = body;
                const room = await getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.host !== hostName) {
                    return res.status(403).json({ error: 'Only host can start game' });
                }
                
                if (room.players.length < 2) {
                    return res.status(400).json({ error: 'Need at least 2 players' });
                }
                
                room.status = 'submitting';
                room.currentRound = 1;
                room.submissions = [];
                room.bets = [];
                room.updatedAt = now();
                
                // Pick a prompt that hasn't been used
                const prompts = getPromptsForCategory(room.category);
                const availablePrompts = prompts.filter(p => !room.usedPrompts.includes(p));
                const prompt = availablePrompts.length > 0 
                    ? availablePrompts[Math.floor(Math.random() * availablePrompts.length)]
                    : prompts[Math.floor(Math.random() * prompts.length)];
                
                room.jokePrompt = prompt;
                room.usedPrompts.push(prompt);
                room.phaseEndsAt = now() + 60000; // 60 seconds for submission
                room.roundStartedAt = now();
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ success: true, room });
            }

            case 'submitPunchline': {
                const { roomId, playerName, punchline } = body;
                const room = await getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.status !== 'submitting') {
                    return res.status(400).json({ error: 'Not in submission phase' });
                }
                
                const existing = room.submissions.find(s => s.playerName === playerName);
                if (existing) {
                    return res.status(400).json({ error: 'Already submitted' });
                }
                
                room.submissions.push({
                    id: room.submissions.length + 1,
                    playerName,
                    punchline,
                    submittedAt: now()
                });
                room.updatedAt = now();
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ 
                    success: true, 
                    submissionCount: room.submissions.length,
                    totalPlayers: room.players.length 
                });
            }

            case 'startBetting': {
                const { roomId, hostName } = body;
                const room = await getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.host !== hostName) {
                    return res.status(403).json({ error: 'Only host can advance phases' });
                }
                
                if (room.submissions.length < 2) {
                    return res.status(400).json({ error: 'Need at least 2 submissions' });
                }
                
                room.status = 'betting';
                room.bets = [];
                room.phaseEndsAt = now() + 45000; // 45 seconds for betting
                room.updatedAt = now();
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ success: true, room });
            }

            case 'placeBet': {
                const { roomId, playerName, submissionId, amount } = body;
                const room = await getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.status !== 'betting') {
                    return res.status(400).json({ error: 'Not in betting phase' });
                }
                
                const existing = room.bets.find(b => b.playerName === playerName);
                if (existing) {
                    return res.status(400).json({ error: 'Already placed bet' });
                }
                
                room.bets.push({
                    playerName,
                    submissionId,
                    amount: amount || 50,
                    placedAt: now()
                });
                room.updatedAt = now();
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ 
                    success: true, 
                    betCount: room.bets.length,
                    totalPlayers: room.players.length 
                });
            }

            case 'judgeRound': {
                const { roomId, hostName } = body;
                const room = await getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.host !== hostName) {
                    return res.status(403).json({ error: 'Only host can trigger judging' });
                }
                
                room.status = 'judging';
                room.updatedAt = now();
                
                // Simulate AI judging delay
                const winnerId = pickWinner(room.submissions);
                const winningSubmission = room.submissions.find(s => s.id === winnerId);
                
                const roundResult = {
                    round: room.currentRound,
                    winnerId,
                    winnerName: winningSubmission.playerName,
                    winningPunchline: winningSubmission.punchline,
                    scores: {}
                };
                
                // Author bonus
                const player = room.players.find(p => p.name === winningSubmission.playerName);
                if (player) {
                    player.score += 100;
                    roundResult.scores[player.name] = 100;
                }
                
                // Correct prediction bonus
                room.bets.forEach(bet => {
                    if (bet.submissionId === winnerId) {
                        const betPlayer = room.players.find(p => p.name === bet.playerName);
                        if (betPlayer) {
                            betPlayer.score += bet.amount * 2;
                            roundResult.scores[bet.playerName] = (roundResult.scores[bet.playerName] || 0) + bet.amount * 2;
                        }
                    }
                });
                
                room.roundResults.push(roundResult);
                room.status = 'roundResults';
                room.phaseEndsAt = null;
                room.updatedAt = now();
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ success: true, room, roundResult });
            }

            case 'nextRound': {
                const { roomId, hostName } = body;
                const room = await getRoom(roomId);
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.host !== hostName) {
                    return res.status(403).json({ error: 'Only host can advance' });
                }
                
                if (room.currentRound >= room.totalRounds) {
                    room.status = 'finished';
                    
                    // Update global leaderboard
                    for (const p of room.players) {
                        await updateLeaderboard(p.name, p.score);
                    }
                    
                    await setRoom(roomId, room);
                    const leaderboard = await getLeaderboard();
                    
                    return res.status(200).json({ 
                        success: true, 
                        room,
                        finalStandings: [...room.players].sort((a, b) => b.score - a.score),
                        leaderboard: leaderboard.slice(0, 10)
                    });
                }
                
                room.currentRound++;
                room.status = 'submitting';
                room.submissions = [];
                room.bets = [];
                
                // Pick new unused prompt
                const prompts = getPromptsForCategory(room.category);
                const availablePrompts = prompts.filter(p => !room.usedPrompts.includes(p));
                const prompt = availablePrompts.length > 0 
                    ? availablePrompts[Math.floor(Math.random() * availablePrompts.length)]
                    : prompts[Math.floor(Math.random() * prompts.length)];
                
                room.jokePrompt = prompt;
                room.usedPrompts.push(prompt);
                room.phaseEndsAt = now() + 60000;
                room.roundStartedAt = now();
                room.updatedAt = now();
                
                await setRoom(roomId, room);
                
                return res.status(200).json({ success: true, room });
            }

            case 'getLeaderboard': {
                const leaderboard = await getLeaderboard();
                return res.status(200).json({ 
                    success: true, 
                    leaderboard: leaderboard.slice(0, 20) 
                });
            }

            default:
                return res.status(400).json({ error: 'Unknown action: ' + action });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
