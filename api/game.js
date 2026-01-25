// In-memory game state
let gameRooms = {};
let globalLeaderboard = [];

// Helper to generate room codes
function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper to get current timestamp
function now() {
    return Date.now();
}

// Clean up old rooms (older than 1 hour)
function cleanupOldRooms() {
    const oneHourAgo = now() - 60 * 60 * 1000;
    for (const roomId in gameRooms) {
        if (gameRooms[roomId].createdAt < oneHourAgo) {
            delete gameRooms[roomId];
        }
    }
}

// Helper: Get prompts for category
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
            "Web3 will change the world when..."
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
            "The best time to buy was..."
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
            "Dating apps taught me that..."
        ]
    };
    return prompts[category] || prompts.general;
}

// Helper: Pick winner (simple random for now)
function pickWinner(submissions) {
    const randomIndex = Math.floor(Math.random() * submissions.length);
    return submissions[randomIndex].id;
}

// Helper: Update leaderboard
function updateLeaderboard(playerName, score) {
    const existing = globalLeaderboard.find(p => p.name === playerName);
    if (existing) {
        existing.totalScore += score;
        existing.gamesPlayed++;
    } else {
        globalLeaderboard.push({
            name: playerName,
            totalScore: score,
            gamesPlayed: 1
        });
    }
    globalLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
}

// Main handler
module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;
    
    // Parse body for POST requests
    let body = {};
    if (req.method === 'POST' && req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    cleanupOldRooms();

    try {
        switch (action) {
            // =====================
            // ROOM MANAGEMENT
            // =====================
            case 'createRoom': {
                const { hostName, category, maxPlayers = 10 } = body;
                if (!hostName) {
                    return res.status(400).json({ error: 'hostName required' });
                }
                
                const roomId = generateRoomCode();
                gameRooms[roomId] = {
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
                    createdAt: now(),
                    updatedAt: now()
                };
                
                return res.status(200).json({ 
                    success: true, 
                    roomId, 
                    room: gameRooms[roomId] 
                });
            }

            case 'joinRoom': {
                const { roomId, playerName } = body;
                if (!roomId || !playerName) {
                    return res.status(400).json({ error: 'roomId and playerName required' });
                }
                
                const room = gameRooms[roomId];
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.status !== 'waiting') {
                    return res.status(400).json({ error: 'Game already started' });
                }
                
                if (room.players.length >= room.maxPlayers) {
                    return res.status(400).json({ error: 'Room is full' });
                }
                
                const existingPlayer = room.players.find(p => p.name === playerName);
                if (existingPlayer) {
                    return res.status(200).json({ success: true, room });
                }
                
                room.players.push({
                    name: playerName,
                    score: 0,
                    isHost: false,
                    joinedAt: now()
                });
                room.updatedAt = now();
                
                return res.status(200).json({ success: true, room });
            }

            case 'getRoom': {
                const roomId = req.query.roomId;
                if (!roomId) {
                    return res.status(400).json({ error: 'roomId required' });
                }
                
                const room = gameRooms[roomId];
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                return res.status(200).json({ success: true, room });
            }

            case 'listRooms': {
                const publicRooms = Object.values(gameRooms)
                    .filter(r => r.status === 'waiting')
                    .map(r => ({
                        id: r.id,
                        host: r.host,
                        category: r.category,
                        players: r.players.length,
                        maxPlayers: r.maxPlayers
                    }));
                
                return res.status(200).json({ success: true, rooms: publicRooms });
            }

            // =====================
            // GAME ACTIONS
            // =====================
            case 'startGame': {
                const { roomId, hostName } = body;
                const room = gameRooms[roomId];
                
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
                
                const prompts = getPromptsForCategory(room.category);
                room.jokePrompt = prompts[Math.floor(Math.random() * prompts.length)];
                room.roundStartedAt = now();
                
                return res.status(200).json({ success: true, room });
            }

            case 'submitPunchline': {
                const { roomId, playerName, punchline } = body;
                const room = gameRooms[roomId];
                
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
                
                return res.status(200).json({ 
                    success: true, 
                    submissionCount: room.submissions.length,
                    totalPlayers: room.players.length 
                });
            }

            case 'startBetting': {
                const { roomId, hostName } = body;
                const room = gameRooms[roomId];
                
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
                room.updatedAt = now();
                
                const anonymizedSubmissions = room.submissions.map((s, i) => ({
                    id: s.id,
                    punchline: s.punchline
                }));
                
                return res.status(200).json({ 
                    success: true, 
                    room,
                    submissions: anonymizedSubmissions 
                });
            }

            case 'placeBet': {
                const { roomId, playerName, submissionId, amount } = body;
                const room = gameRooms[roomId];
                
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
                
                return res.status(200).json({ 
                    success: true, 
                    betCount: room.bets.length,
                    totalPlayers: room.players.length 
                });
            }

            case 'judgeRound': {
                const { roomId, hostName } = body;
                const room = gameRooms[roomId];
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.host !== hostName) {
                    return res.status(403).json({ error: 'Only host can trigger judging' });
                }
                
                room.status = 'judging';
                room.updatedAt = now();
                
                const winnerId = pickWinner(room.submissions);
                const winningSubmission = room.submissions.find(s => s.id === winnerId);
                
                const roundResult = {
                    round: room.currentRound,
                    winnerId,
                    winnerName: winningSubmission.playerName,
                    winningPunchline: winningSubmission.punchline,
                    scores: {}
                };
                
                const player = room.players.find(p => p.name === winningSubmission.playerName);
                if (player) {
                    player.score += 100;
                    roundResult.scores[player.name] = (roundResult.scores[player.name] || 0) + 100;
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
                
                room.roundResults.push(roundResult);
                room.status = 'roundResults';
                room.updatedAt = now();
                
                return res.status(200).json({ 
                    success: true, 
                    room,
                    roundResult 
                });
            }

            case 'nextRound': {
                const { roomId, hostName } = body;
                const room = gameRooms[roomId];
                
                if (!room) {
                    return res.status(404).json({ error: 'Room not found' });
                }
                
                if (room.host !== hostName) {
                    return res.status(403).json({ error: 'Only host can advance' });
                }
                
                if (room.currentRound >= room.totalRounds) {
                    room.status = 'finished';
                    
                    room.players.forEach(p => {
                        updateLeaderboard(p.name, p.score);
                    });
                    
                    return res.status(200).json({ 
                        success: true, 
                        room,
                        finalStandings: room.players.sort((a, b) => b.score - a.score),
                        leaderboard: globalLeaderboard.slice(0, 10)
                    });
                }
                
                room.currentRound++;
                room.status = 'submitting';
                room.submissions = [];
                room.bets = [];
                
                const prompts = getPromptsForCategory(room.category);
                const usedPrompts = room.roundResults.map(r => r.prompt).filter(Boolean);
                const availablePrompts = prompts.filter(p => !usedPrompts.includes(p));
                room.jokePrompt = availablePrompts.length > 0 
                    ? availablePrompts[Math.floor(Math.random() * availablePrompts.length)]
                    : prompts[Math.floor(Math.random() * prompts.length)];
                
                room.roundStartedAt = now();
                room.updatedAt = now();
                
                return res.status(200).json({ success: true, room });
            }

            // =====================
            // LEADERBOARD
            // =====================
            case 'getLeaderboard': {
                return res.status(200).json({ 
                    success: true, 
                    leaderboard: globalLeaderboard.slice(0, 20) 
                });
            }

            default:
                return res.status(400).json({ error: 'Unknown action: ' + action });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
