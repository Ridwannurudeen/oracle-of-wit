// Oracle of Wit API - Supports Multiplayer & Single-Player
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const SUBMISSION_TIME = 60000;
const BETTING_TIME = 45000;

// Bot names and punchlines for single-player mode
const BOT_NAMES = ['WittyBot', 'JokesMaster', 'PunLord', 'ComedyAI', 'LaughBot', 'HumorEngine'];
const BOT_PUNCHLINES = {
    tech: [
        "...the bartender says 'Sorry, we don't serve your type here.'",
        "...he couldn't find any Java at home.",
        "...it was a feature request in disguise.",
        "...they both agreed humans are the real bugs.",
        "...the gas fees were higher than the drink prices.",
        "...I immediately mass e-mail my team asking who broke it.",
        "...'Have you tried mass downvotes?'",
        "...'Your code is like abstract art - nobody understands it but everyone pretends to.'",
        "...someone mass-promoted the intern's PR to production.",
        "...everyone was mass-refreshing the memepool."
    ],
    crypto: [
        "...I mass-bought more dip.",
        "...wen mass-adoption?",
        "...it was a mass-migration to another chain.",
        "...'Few understand' became 'None understand'.",
        "...my mass-produced NFTs are now worth negative ETH.",
        "...the whales mass-dumped during my bathroom break.",
        "...I wrote it in crayon during a mass-delusion.",
        "...I'm mass-collecting tax write-offs now.",
        "...because mass-hopium is my only strategy.",
        "...right before the mass-extinction event."
    ],
    general: [
        "...it became a mass-email chain.",
        "...January 2nd hit different.",
        "...it's 'password123' but with mass-creativity.",
        "...strategically mass-avoiding responsibilities.",
        "...mass-napping is underrated.",
        "...pretending to know what you're doing, en masse.",
        "...I need to mass-produce better excuses.",
        "...I'm mass-cultivating my couch relationship.",
        "...my alarm had a mass-malfunction. For 3 hours.",
        "...people are mass-swiping on their red flags."
    ]
};

// Redis helpers
async function redisGet(key) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
        const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result ? JSON.parse(data.result) : null;
    } catch (e) { return null; }
}

async function redisSet(key, value, exSeconds = 7200) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
    try {
        await fetch(`${UPSTASH_URL}/set/${key}?EX=${exSeconds}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(value)
        });
        return true;
    } catch (e) { return false; }
}

async function redisKeys(pattern) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
    try {
        const res = await fetch(`${UPSTASH_URL}/keys/${pattern}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const data = await res.json();
        return data.result || [];
    } catch (e) { return []; }
}

// In-memory fallback
const fallbackRooms = {};
const fallbackLeaderboard = [];

async function getRoom(roomId) {
    let room = await redisGet(`room:${roomId}`) || fallbackRooms[roomId];
    if (!room) return null;
    room = await checkAutoAdvance(room);
    return room;
}

async function setRoom(roomId, room) {
    fallbackRooms[roomId] = room;
    await redisSet(`room:${roomId}`, room);
}

async function getLeaderboard() {
    return await redisGet('leaderboard') || [...fallbackLeaderboard];
}

async function setLeaderboard(lb) {
    fallbackLeaderboard.length = 0;
    fallbackLeaderboard.push(...lb);
    await redisSet('leaderboard', lb);
}

// Auto-advance when timer expires
async function checkAutoAdvance(room) {
    if (!room?.phaseEndsAt) return room;
    const now = Date.now();
    
    if (room.status === 'submitting' && now >= room.phaseEndsAt) {
        // Add bot submissions for single-player
        if (room.isSinglePlayer) {
            addBotSubmissions(room);
        }
        
        if (room.submissions.length >= 1) {
            room.status = 'betting';
            room.bets = [];
            room.phaseEndsAt = now + BETTING_TIME;
            room.updatedAt = now;
            await setRoom(room.id, room);
        }
    } else if (room.status === 'betting' && now >= room.phaseEndsAt) {
        // Add bot bets for single-player
        if (room.isSinglePlayer) {
            addBotBets(room);
        }
        room = await autoJudge(room);
    }
    
    return room;
}

// Add bot submissions in single-player mode
function addBotSubmissions(room) {
    const punchlines = BOT_PUNCHLINES[room.category] || BOT_PUNCHLINES.general;
    const botsToAdd = room.players.filter(p => p.isBot && !room.submissions.find(s => s.playerName === p.name));
    
    botsToAdd.forEach(bot => {
        const availablePunchlines = punchlines.filter(p => !room.submissions.find(s => s.punchline === p));
        const punchline = availablePunchlines[Math.floor(Math.random() * availablePunchlines.length)] || punchlines[0];
        room.submissions.push({
            id: room.submissions.length + 1,
            playerName: bot.name,
            punchline,
            submittedAt: Date.now()
        });
    });
}

// Add bot bets in single-player mode
function addBotBets(room) {
    const botsToAdd = room.players.filter(p => p.isBot && !room.bets.find(b => b.playerName === p.name));
    
    botsToAdd.forEach(bot => {
        // Bots pick randomly (but not their own submission)
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

async function autoJudge(room) {
    const now = Date.now();
    room.status = 'judging';
    
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
    const authorPlayer = room.players.find(p => p.name === winningSubmission.playerName);
    if (authorPlayer) {
        authorPlayer.score += 100;
        roundResult.scores[authorPlayer.name] = 100;
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
    room.updatedAt = now;
    
    await setRoom(room.id, room);
    return room;
}

function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPromptsForCategory(category) {
    const prompts = {
        tech: [
            "An AI, a blockchain, and a smart contract walk into a bar...",
            "Why did the developer quit? Because...",
            "The bug wasn't a bug, it was...",
            "ChatGPT and Claude got into an argument about...",
            "My code worked on the first try, which means...",
            "The senior dev looked at my PR and said...",
            "I asked AI to fix my code and it replied...",
            "The blockchain was congested because...",
            "Web3 will change the world when...",
            "The AI became sentient and its first words were...",
            "My mass-deployment script failed because...",
            "The intern mass-pushed to production and...",
            "Stack Overflow mass-downvoted my question because..."
        ],
        crypto: [
            "WAGMI until...",
            "The real utility of this NFT is...",
            "I bought the dip, but then...",
            "Wen moon? More like...",
            "The whitepaper promised..., but delivered...",
            "My portfolio is down 90% because...",
            "Diamond hands means...",
            "I'm not selling because...",
            "The best time to mass-buy was...",
            "My seed phrase is safe because...",
            "The gas fees were so high that...",
            "I told my family I mass-invest in crypto and they said...",
            "The mass-airdrop was worth..."
        ],
        general: [
            "The meeting could have been an email, but instead...",
            "My New Year's resolution mass-lasted until...",
            "The WiFi password is...",
            "I'm not procrastinating, I'm...",
            "Life hack: instead of being productive...",
            "The secret to mass-success is...",
            "My therapist said I need to...",
            "The gym membership was worth it because...",
            "I told my boss I was late because...",
            "Dating apps taught me that...",
            "The fortune cookie mass-predicted...",
            "I'm not lazy, I'm just...",
            "My superpower would be mass-..."
        ]
    };
    return prompts[category] || prompts.general;
}

function getNextPrompt(room) {
    const prompts = getPromptsForCategory(room.category);
    const available = prompts.filter(p => !room.usedPrompts.includes(p));
    const prompt = available.length > 0 
        ? available[Math.floor(Math.random() * available.length)]
        : prompts[Math.floor(Math.random() * prompts.length)];
    room.usedPrompts.push(prompt);
    return prompt;
}

function pickWinner(submissions) {
    if (!submissions?.length) return null;
    return submissions[Math.floor(Math.random() * submissions.length)].id;
}

async function updateLeaderboard(playerName, score, isBot = false) {
    if (isBot) return; // Don't add bots to leaderboard
    const lb = await getLeaderboard();
    const existing = lb.find(p => p.name === playerName);
    if (existing) {
        existing.totalScore += score;
        existing.gamesPlayed++;
    } else {
        lb.push({ name: playerName, totalScore: score, gamesPlayed: 1 });
    }
    lb.sort((a, b) => b.totalScore - a.totalScore);
    await setLeaderboard(lb.slice(0, 100));
}

// Main handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const body = req.body || {};

    try {
        switch (action) {
            case 'createRoom': {
                const { hostName, category, maxPlayers = 10, singlePlayer = false } = body;
                if (!hostName) return res.status(400).json({ error: 'hostName required' });
                
                const roomId = generateRoomCode();
                const players = [{ name: hostName, score: 0, isHost: true, isBot: false, joinedAt: Date.now() }];
                
                // Add bots for single-player mode
                if (singlePlayer) {
                    const numBots = 3; // 3 bot opponents
                    const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
                    for (let i = 0; i < numBots; i++) {
                        players.push({
                            name: shuffledBots[i],
                            score: 0,
                            isHost: false,
                            isBot: true,
                            joinedAt: Date.now()
                        });
                    }
                }
                
                const room = {
                    id: roomId,
                    host: hostName,
                    category: category || 'tech',
                    maxPlayers,
                    players,
                    status: 'waiting',
                    currentRound: 0,
                    totalRounds: 3,
                    jokePrompt: '',
                    submissions: [],
                    bets: [],
                    roundResults: [],
                    usedPrompts: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    phaseEndsAt: null,
                    isSinglePlayer: singlePlayer
                };
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, roomId, room });
            }

            case 'joinRoom': {
                const { roomId, playerName } = body;
                if (!roomId || !playerName) return res.status(400).json({ error: 'roomId and playerName required' });
                
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found. It may have expired.' });
                if (room.status !== 'waiting') return res.status(400).json({ error: 'Game already started' });
                if (room.isSinglePlayer) return res.status(400).json({ error: 'Cannot join single-player game' });
                if (room.players.length >= room.maxPlayers) return res.status(400).json({ error: 'Room is full' });
                
                if (!room.players.find(p => p.name === playerName)) {
                    room.players.push({ name: playerName, score: 0, isHost: false, isBot: false, joinedAt: Date.now() });
                    room.updatedAt = Date.now();
                    await setRoom(roomId, room);
                }
                
                return res.status(200).json({ success: true, room });
            }

            case 'getRoom': {
                const roomId = req.query.roomId;
                if (!roomId) return res.status(400).json({ error: 'roomId required' });
                
                const room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                
                return res.status(200).json({ success: true, room });
            }

            case 'listRooms': {
                const keys = await redisKeys('room:*');
                const publicRooms = [];
                
                for (const key of keys.slice(0, 20)) {
                    const room = await getRoom(key.replace('room:', ''));
                    if (room && room.status === 'waiting' && !room.isSinglePlayer) {
                        publicRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers
                        });
                    }
                }
                
                for (const roomId in fallbackRooms) {
                    const room = fallbackRooms[roomId];
                    if (room?.status === 'waiting' && !room.isSinglePlayer && !publicRooms.find(r => r.id === roomId)) {
                        publicRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers
                        });
                    }
                }
                
                return res.status(200).json({ success: true, rooms: publicRooms });
            }

            case 'startGame': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can start game' });
                if (!room.isSinglePlayer && room.players.length < 2) return res.status(400).json({ error: 'Need at least 2 players' });
                
                const now = Date.now();
                room.status = 'submitting';
                room.currentRound = 1;
                room.submissions = [];
                room.bets = [];
                room.jokePrompt = getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'submitPunchline': {
                const { roomId, playerName, punchline } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'submitting') return res.status(400).json({ error: 'Not in submission phase' });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (room.submissions.find(s => s.playerName === playerName)) return res.status(400).json({ error: 'Already submitted' });
                
                room.submissions.push({
                    id: room.submissions.length + 1,
                    playerName,
                    punchline,
                    submittedAt: Date.now()
                });
                room.updatedAt = Date.now();
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, submissionCount: room.submissions.length, totalPlayers: room.players.length });
            }

            case 'placeBet': {
                const { roomId, playerName, submissionId, amount } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'betting') return res.status(400).json({ error: 'Not in betting phase' });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (room.bets.find(b => b.playerName === playerName)) return res.status(400).json({ error: 'Already placed bet' });
                
                room.bets.push({ playerName, submissionId, amount: amount || 50, placedAt: Date.now() });
                room.updatedAt = Date.now();
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, betCount: room.bets.length, totalPlayers: room.players.length });
            }

            case 'advancePhase': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can advance' });
                
                const now = Date.now();
                
                if (room.status === 'submitting') {
                    if (room.isSinglePlayer) addBotSubmissions(room);
                    if (room.submissions.length >= 1) {
                        room.status = 'betting';
                        room.bets = [];
                        room.phaseEndsAt = now + BETTING_TIME;
                        room.updatedAt = now;
                        await setRoom(roomId, room);
                    }
                } else if (room.status === 'betting') {
                    if (room.isSinglePlayer) addBotBets(room);
                    room = await autoJudge(room);
                }
                
                return res.status(200).json({ success: true, room });
            }

            case 'nextRound': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can advance' });
                
                if (room.currentRound >= room.totalRounds) {
                    room.status = 'finished';
                    for (const p of room.players) {
                        await updateLeaderboard(p.name, p.score, p.isBot);
                    }
                    await setRoom(roomId, room);
                    const leaderboard = await getLeaderboard();
                    return res.status(200).json({ 
                        success: true, room,
                        finalStandings: [...room.players].sort((a, b) => b.score - a.score),
                        leaderboard: leaderboard.slice(0, 10)
                    });
                }
                
                const now = Date.now();
                room.currentRound++;
                room.status = 'submitting';
                room.submissions = [];
                room.bets = [];
                room.jokePrompt = getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'getLeaderboard': {
                const leaderboard = await getLeaderboard();
                return res.status(200).json({ success: true, leaderboard: leaderboard.slice(0, 20) });
            }

            default:
                return res.status(400).json({ error: 'Unknown action: ' + action });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
