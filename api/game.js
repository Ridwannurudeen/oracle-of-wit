// Oracle of Wit API — Powered by GenLayer Intelligent Contracts

import { redisGet, redisSet, redisKeys } from './lib/redis.js';
import { getCorsOrigin, generateToken, storeSessionToken, validateSession, checkRateLimit } from './lib/auth.js';
import { SUBMISSION_TIME, BETTING_TIME, VOTING_TIME, BOT_NAMES, PROMPT_PUNCHLINES, FALLBACK_PUNCHLINES, ACHIEVEMENTS, getCurrentTheme } from './lib/constants.js';
import { getGenLayerClient, createGameOnChain, recordOnChain, appealWithGenLayer, postGameToDiscord } from './lib/genlayer.js';
import { pickWinnerWithAI, curateSubmissions } from './lib/ai.js';
import { transitionFromSubmitting, checkAutoAdvance, autoJudge, tallyVotesAndJudge, addBotBets, getNextPrompt, acquireAdvanceLock, releaseAdvanceLock } from './lib/game-logic.js';
import { getProfile, saveProfile, createDefaultProfile, checkAchievements, getNextLevelXP, getTodayKey, getDailyPrompt, getCurrentSeasonKey, getLeaderboard as getLeaderboardFromStore, setLeaderboard as setLeaderboardToStore, updateLeaderboard } from './lib/profiles.js';

const GENLAYER_CONTRACT_ADDRESS = process.env.GENLAYER_CONTRACT_ADDRESS;

// In-memory fallback
const fallbackRooms = {};
const fallbackLeaderboard = [];

const VALID_CATEGORIES = ['tech', 'crypto', 'general'];

function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    // Strip control chars except newline, trim
    return str.replace(/[\x00-\x09\x0B-\x1F]/g, '').trim();
}

// --- Room storage helpers ---

async function getRoomRaw(roomId) {
    let room = await redisGet(`room:${roomId}`) || fallbackRooms[roomId];
    if (!room) return null;
    if (room.version === undefined) room.version = 0;
    return room;
}

async function getRoom(roomId) {
    let room = await getRoomRaw(roomId);
    if (!room) return null;

    // Distributed lock for auto-advance
    const locked = await acquireAdvanceLock(roomId);
    if (locked) {
        try {
            room = await checkAutoAdvance(room, setRoom);
        } finally {
            await releaseAdvanceLock(roomId);
        }
    }
    return room;
}

async function setRoom(roomId, room) {
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();
    fallbackRooms[roomId] = room;

    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return true;

    const success = await redisSet(`room:${roomId}`, room);
    if (!success) {
        console.error(`[Storage] Failed to write room ${roomId} to Redis, using fallback`);
    }
    return true;
}

async function _getLeaderboard() {
    return await getLeaderboardFromStore(fallbackLeaderboard);
}

async function _setLeaderboard(lb) {
    return await setLeaderboardToStore(lb, fallbackLeaderboard);
}

async function _updateLeaderboard(playerName, score, isBot) {
    return await updateLeaderboard(playerName, score, isBot, fallbackLeaderboard);
}

function generateRoomCode() {
    return 'GAME_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Read-only actions that don't need auth tokens
const READ_ONLY_ACTIONS = new Set([
    'getRoom', 'listRooms', 'getLeaderboard', 'getWeeklyTheme', 'getProfile',
    'getDailyChallenge', 'getChallenge', 'ogPreview', 'getHallOfFame',
    'getSeasonalLeaderboard', 'getPlayerHistory', 'getSeasonArchive',
    'getPromptSubmissions'
]);

// Actions that create sessions (return tokens)
const SESSION_CREATING_ACTIONS = new Set(['createRoom', 'joinRoom']);

// Actions that require session validation
const SESSION_REQUIRED_ACTIONS = new Set([
    'startGame', 'submitPunchline', 'placeBet', 'castVote', 'advancePhase',
    'nextRound', 'sendReaction', 'appealVerdict'
]);

// Main handler
export default async function handler(req, res) {
    const origin = req.headers?.origin || '';
    res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(origin));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action } = req.query;
    const body = req.body || {};

    // Rate limiting (per-action granularity)
    const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const allowed = await checkRateLimit(ip, action);
    if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });

    // Session validation for mutating actions
    if (SESSION_REQUIRED_ACTIONS.has(action)) {
        const { roomId, sessionToken } = body;
        const playerName = body.playerName || body.hostName;
        if (!roomId || !playerName) {
            return res.status(401).json({ error: 'roomId and playerName/hostName required' });
        }
        const valid = await validateSession(roomId, playerName, sessionToken);
        if (!valid) return res.status(401).json({ error: 'Invalid or missing session token' });
    }

    try {
        switch (action) {
            case 'createRoom': {
                const { category, maxPlayers = 100, singlePlayer = false } = body;
                const hostName = sanitizeInput(body.hostName);
                if (!hostName) return res.status(400).json({ error: 'hostName required' });
                if (hostName.length > 30) return res.status(400).json({ error: 'Host name too long (max 30 characters)' });
                const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'tech';
                const clampedMaxPlayers = Math.max(2, Math.min(100, Number(maxPlayers) || 100));

                const roomId = generateRoomCode();
                const players = [{ name: hostName, score: 0, isHost: true, isBot: false, joinedAt: Date.now() }];

                if (singlePlayer) {
                    const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
                    for (let i = 0; i < 3; i++) {
                        players.push({ name: shuffledBots[i], score: 0, isHost: false, isBot: true, joinedAt: Date.now() });
                    }
                }

                const room = {
                    id: roomId, host: hostName, category: safeCategory,
                    maxPlayers: clampedMaxPlayers, players, spectators: [],
                    status: 'waiting', currentRound: 0, totalRounds: 5,
                    jokePrompt: '', submissions: [], bets: [], reactions: [],
                    roundResults: [], usedPrompts: [],
                    createdAt: Date.now(), updatedAt: Date.now(),
                    phaseEndsAt: null, isSinglePlayer: singlePlayer,
                    weeklyTheme: getCurrentTheme(), version: 0
                };

                await setRoom(roomId, room);

                // Generate session token
                const token = generateToken();
                await storeSessionToken(roomId, hostName, token);

                // GenLayer create with 1 retry
                (async () => {
                    try {
                        const result = await createGameOnChain(roomId, hostName, room.category);
                        if (!result) {
                            await new Promise(r => setTimeout(r, 2000));
                            await createGameOnChain(roomId, hostName, room.category);
                        }
                    } catch (e) {
                        console.error('[GenLayer] create_game failed after retry:', e.message);
                    }
                })();

                return res.status(200).json({ success: true, roomId, room, sessionToken: token });
            }

            case 'joinRoom': {
                const { roomId, spectator } = body;
                const playerName = sanitizeInput(body.playerName);
                if (!roomId || !playerName) return res.status(400).json({ error: 'roomId and playerName required' });
                if (playerName.length > 30) return res.status(400).json({ error: 'Player name too long (max 30 characters)' });

                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found. It may have expired.' });

                if (!room.spectators) room.spectators = [];

                if (spectator) {
                    const existing = room.spectators.find(s => s.name === playerName);
                    if (existing) {
                        existing.joinedAt = Date.now();
                    } else {
                        if (room.spectators.length >= 50) return res.status(400).json({ error: 'Spectator limit reached' });
                        room.spectators.push({ name: playerName, joinedAt: Date.now() });
                    }
                    room.updatedAt = Date.now();
                    await setRoom(roomId, room);
                    return res.status(200).json({ success: true, room, spectating: true });
                }

                if (room.status !== 'waiting') return res.status(400).json({ error: 'Game already started' });
                if (room.isSinglePlayer) return res.status(400).json({ error: 'Cannot join single-player game' });
                if (room.players.length >= room.maxPlayers) return res.status(400).json({ error: 'Room is full' });
                if (room.players.find(p => p.name === playerName)) return res.status(400).json({ error: 'Player already in room' });

                room.players.push({ name: playerName, score: 0, isHost: false, isBot: false, joinedAt: Date.now() });
                room.updatedAt = Date.now();
                await setRoom(roomId, room);

                // Generate session token
                const token = generateToken();
                await storeSessionToken(roomId, playerName, token);

                return res.status(200).json({ success: true, room, sessionToken: token });
            }

            case 'getRoom': {
                const roomId = req.query.roomId;
                if (!roomId) return res.status(400).json({ error: 'roomId required' });
                const room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                return res.status(200).json({ success: true, room });
            }

            case 'listRooms': {
                const page = Math.max(1, parseInt(req.query.page, 10) || 1);
                const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

                const allRooms = [];
                const seenIds = new Set();

                const keys = await redisKeys('room:*');
                for (const key of keys) {
                    const roomId = key.replace('room:', '');
                    const room = await getRoom(roomId);
                    if (room && !room.isSinglePlayer && room.status !== 'finished') {
                        seenIds.add(roomId);
                        allRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers,
                            status: room.status, spectators: (room.spectators || []).length,
                            currentRound: room.currentRound, totalRounds: room.totalRounds
                        });
                    }
                }

                for (const roomId in fallbackRooms) {
                    if (seenIds.has(roomId)) continue;
                    const room = fallbackRooms[roomId];
                    if (room && !room.isSinglePlayer && room.status !== 'finished') {
                        allRooms.push({
                            id: room.id, host: room.host, category: room.category,
                            players: room.players.length, maxPlayers: room.maxPlayers,
                            status: room.status, spectators: (room.spectators || []).length,
                            currentRound: room.currentRound, totalRounds: room.totalRounds
                        });
                    }
                }

                const total = allRooms.length;
                const offset = (page - 1) * limit;
                const rooms = allRooms.slice(offset, offset + limit);

                return res.status(200).json({ success: true, rooms, page, limit, total });
            }

            case 'startGame': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'waiting') return res.status(400).json({ error: 'Game already started' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can start game' });
                if (!room.isSinglePlayer && room.players.length < 2) return res.status(400).json({ error: 'Need at least 2 players' });

                const now = Date.now();
                room.status = 'submitting';
                room.currentRound = 1;
                room.submissions = [];
                room.bets = [];
                room.reactions = [];
                room.jokePrompt = await getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                room.betBudgets = {};
                for (const p of room.players) room.betBudgets[p.name] = 300;

                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'submitPunchline': {
                const { roomId, playerName } = body;
                const punchline = sanitizeInput(body.punchline);
                if (!punchline) return res.status(400).json({ error: 'Punchline cannot be empty' });
                if (punchline.length > 200) return res.status(400).json({ error: 'Punchline too long (max 200 characters)' });

                let room = await getRoomRaw(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (!room.players.find(p => p.name === playerName)) return res.status(403).json({ error: 'Not a player in this room' });
                if (room.status !== 'submitting') return res.status(400).json({ error: 'Not in submission phase', currentStatus: room.status });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (room.submissions.find(s => s.playerName === playerName)) return res.status(400).json({ error: 'Already submitted' });

                room.submissions.push({ id: room.submissions.length + 1, playerName, punchline, submittedAt: Date.now() });
                room.updatedAt = Date.now();
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, submissionCount: room.submissions.length, totalPlayers: room.players.length });
            }

            case 'placeBet': {
                const { roomId, playerName, amount } = body;
                const submissionId = parseInt(body.submissionId);
                if (!submissionId || isNaN(submissionId)) return res.status(400).json({ error: 'Invalid submission ID' });
                let room = await getRoomRaw(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'betting') return res.status(400).json({ error: 'Not in betting phase' });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (!room.submissions.find(s => s.id === submissionId)) return res.status(400).json({ error: 'Invalid submission' });
                if (room.bets.find(b => b.playerName === playerName)) return res.status(400).json({ error: 'Already placed bet' });

                if (!room.betBudgets) room.betBudgets = {};
                const budget = room.betBudgets[playerName] ?? 300;
                if (budget < 10) return res.status(400).json({ error: 'Insufficient budget (minimum bet is 10)' });
                const betAmount = Math.max(10, Math.min(amount || 50, 100, budget));

                room.betBudgets[playerName] = budget - betAmount;
                room.bets.push({ playerName, submissionId, amount: betAmount, placedAt: Date.now() });
                room.updatedAt = Date.now();
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, betCount: room.bets.length, totalPlayers: room.players.length, remainingBudget: room.betBudgets[playerName] });
            }

            case 'castVote': {
                const { roomId, playerName } = body;
                const submissionId = parseInt(body.submissionId);
                if (!submissionId || isNaN(submissionId)) return res.status(400).json({ error: 'Invalid submission ID' });
                let room = await getRoomRaw(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'voting') return res.status(400).json({ error: 'Not in voting phase' });
                if (room.phaseEndsAt && Date.now() > room.phaseEndsAt) return res.status(400).json({ error: 'Time expired' });
                if (!room.players.find(p => p.name === playerName)) return res.status(403).json({ error: 'Not a player' });
                if (!room.curatedIds?.includes(submissionId)) return res.status(400).json({ error: 'Not a curated submission' });

                const sub = room.submissions.find(s => s.id === submissionId);
                if (sub?.playerName === playerName) return res.status(400).json({ error: 'Cannot vote for yourself' });

                if (!room.audienceVotes) room.audienceVotes = {};
                if (room.audienceVotes[playerName]) return res.status(400).json({ error: 'Already voted' });

                room.audienceVotes[playerName] = submissionId;
                room.updatedAt = Date.now();
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, voteCount: Object.keys(room.audienceVotes).length, totalPlayers: room.players.length });
            }

            case 'advancePhase': {
                const { roomId, hostName } = body;
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can advance' });

                const now = Date.now();
                if (room.status === 'submitting') {
                    await transitionFromSubmitting(room, setRoom);
                } else if (room.status === 'curating') {
                    if (!room.curatedIds) {
                        const ids = await curateSubmissions(room.submissions, room.jokePrompt, room.category);
                        room.curatedIds = ids || [...room.submissions].sort(() => Math.random() - 0.5).slice(0, 8).map(s => s.id);
                    }
                    room.status = 'voting';
                    room.audienceVotes = {};
                    room.phaseEndsAt = now + VOTING_TIME;
                    room.updatedAt = now;
                    await setRoom(roomId, room);
                } else if (room.status === 'voting') {
                    room = await tallyVotesAndJudge(room, setRoom);
                } else if (room.status === 'betting') {
                    if (room.isSinglePlayer) {
                        addBotBets(room);
                        await setRoom(roomId, room);
                    }
                    room = await autoJudge(room, setRoom);
                }
                return res.status(200).json({ success: true, room });
            }

            case 'nextRound': {
                const { roomId, hostName, playerId } = body;
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.host !== hostName) return res.status(403).json({ error: 'Only host can advance' });

                if (room.currentRound >= room.totalRounds) {
                    room.status = 'finished';
                    for (const p of room.players) await _updateLeaderboard(p.name, p.score, p.isBot);
                    await setRoom(roomId, room);

                    // GenLayer record with 1 retry
                    (async () => {
                        try {
                            const result = await recordOnChain(roomId, room.players);
                            if (!result) {
                                await new Promise(r => setTimeout(r, 2000));
                                await recordOnChain(roomId, room.players);
                            }
                        } catch (e) {
                            console.error('[GenLayer] record_game_result failed after retry:', e.message);
                        }
                    })();
                    postGameToDiscord(room).catch(e => console.error('[Discord] error:', e.message));

                    const leaderboard = await _getLeaderboard();
                    let profileUpdate = null;
                    if (playerId) {
                        try {
                            let profile = await getProfile(playerId);
                            if (profile) {
                                const standings = [...room.players].sort((a, b) => b.score - a.score);
                                const playerData = room.players.find(p => p.name === profile.name);
                                const isWinner = standings[0]?.name === profile.name;

                                profile.lifetimeXP += playerData?.score || 0;
                                profile.gamesPlayed++;
                                if (isWinner) profile.gamesWon++;
                                profile.lastPlayedAt = Date.now();

                                let roundsWonThisGame = 0, correctBetsThisGame = 0, hadComeback = false;
                                for (const rr of (room.roundResults || [])) {
                                    if (rr.winnerName === profile.name) roundsWonThisGame++;
                                    if (rr.isComeback && rr.winnerName === profile.name) hadComeback = true;
                                }
                                for (const rr of (room.roundResults || [])) {
                                    if ((rr.scores?.[profile.name] || 0) > 0) {
                                        const winBonus = rr.winnerName === profile.name ? 100 : 0;
                                        if ((rr.scores[profile.name] || 0) > winBonus) correctBetsThisGame++;
                                    }
                                }

                                profile.roundsWon += roundsWonThisGame;
                                profile.totalCorrectBets += correctBetsThisGame;
                                const currentStreak = room.streaks?.[profile.name] || 0;
                                if (currentStreak > profile.bestStreak) profile.bestStreak = currentStreak;

                                const newAchievements = checkAchievements(profile, {
                                    perfectGame: roundsWonThisGame === room.totalRounds,
                                    comeback: hadComeback
                                });
                                await saveProfile(profile);
                                profileUpdate = { profile, newAchievements };
                            }
                        } catch(e) { console.error('Profile update failed:', e); }
                    }

                    return res.status(200).json({
                        success: true, room,
                        finalStandings: [...room.players].sort((a, b) => b.score - a.score),
                        leaderboard: leaderboard.slice(0, 10),
                        profileUpdate
                    });
                }

                const now = Date.now();
                room.currentRound++;
                room.status = 'submitting';
                room.submissions = [];
                room.bets = [];
                room.reactions = [];
                room.curatedIds = null;
                room.audienceVotes = {};
                room.jokePrompt = await getNextPrompt(room);
                room.phaseEndsAt = now + SUBMISSION_TIME;
                room.roundStartedAt = now;
                room.updatedAt = now;
                await setRoom(roomId, room);
                return res.status(200).json({ success: true, room });
            }

            case 'sendReaction': {
                const { roomId, playerName, emoji } = body;
                const submissionId = parseInt(body.submissionId);
                if (!submissionId || isNaN(submissionId)) return res.status(400).json({ error: 'Invalid submission ID' });
                let room = await getRoom(roomId);
                if (!room || room.status !== 'betting') return res.status(400).json({ error: 'Not in betting phase' });
                if (!room.players.find(p => p.name === playerName)) return res.status(403).json({ error: 'Not a player' });
                if (!room.submissions.find(s => s.id === submissionId)) return res.status(400).json({ error: 'Invalid submission' });
                const ALLOWED_EMOJI = ['\u{1F602}','\u{1F525}','\u{1F480}','\u{1F610}','\u{1F44F}','\u{1F92E}'];
                if (!ALLOWED_EMOJI.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji' });
                if (!room.reactions) room.reactions = [];
                if (room.reactions.filter(r => r.playerName === playerName).length >= 3) return res.status(400).json({ error: 'Max reactions reached' });
                room.reactions.push({ playerName, submissionId, emoji, at: Date.now() });
                room.updatedAt = Date.now();
                await setRoom(roomId, room);
                return res.status(200).json({ success: true });
            }

            case 'getLeaderboard': {
                const leaderboard = await _getLeaderboard();
                return res.status(200).json({ success: true, leaderboard: leaderboard.slice(0, 20) });
            }

            case 'getWeeklyTheme': {
                const theme = getCurrentTheme();
                return res.status(200).json({ success: true, theme: { name: theme.name, emoji: theme.emoji, description: theme.description } });
            }

            case 'getProfile': {
                const playerId = body.playerId || req.query.playerId;
                if (!playerId) return res.status(400).json({ error: 'playerId required' });
                const profile = await getProfile(playerId);
                if (!profile) return res.status(404).json({ error: 'Profile not found' });
                return res.status(200).json({ success: true, profile, nextLevelXP: getNextLevelXP(profile.lifetimeXP), achievements: ACHIEVEMENTS });
            }

            case 'createProfile': {
                const { playerId, playerName } = body;
                if (!playerId || !playerName) return res.status(400).json({ error: 'playerId and playerName required' });
                let profile = await getProfile(playerId);
                if (!profile) { profile = createDefaultProfile(playerId, playerName); await saveProfile(profile); }
                else if (profile.name !== playerName) { profile.name = playerName; await saveProfile(profile); }
                return res.status(200).json({ success: true, profile, nextLevelXP: getNextLevelXP(profile.lifetimeXP), achievements: ACHIEVEMENTS });
            }

            case 'getDailyChallenge': {
                const { playerId } = body;
                const dateKey = getTodayKey();
                const prompt = getDailyPrompt();
                const played = playerId ? await redisGet(`daily:${dateKey}:played:${playerId}`) : false;
                const lb = await redisGet(`daily:${dateKey}:lb`) || [];
                return res.status(200).json({ success: true, daily: { date: dateKey, prompt, alreadyPlayed: !!played, leaderboard: lb.slice(0, 20) } });
            }

            case 'submitDailyChallenge': {
                const { playerId, playerName, punchline } = body;
                if (!playerId || !playerName || !punchline) return res.status(400).json({ error: 'playerId, playerName, and punchline required' });
                const dateKey = getTodayKey();
                const played = await redisGet(`daily:${dateKey}:played:${playerId}`);
                if (played) return res.status(400).json({ error: 'Already played today' });

                const prompt = getDailyPrompt();
                const startTime = Date.now();
                const submissions = [{ id: 1, playerName, punchline }];
                const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, 3);
                let botPunchlines = PROMPT_PUNCHLINES[prompt] ? [...PROMPT_PUNCHLINES[prompt]] : null;
                if (!botPunchlines) {
                    const cat = prompt.toLowerCase().includes('crypto') ? 'crypto' : prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('program') ? 'tech' : 'general';
                    botPunchlines = [...(FALLBACK_PUNCHLINES[cat] || FALLBACK_PUNCHLINES.general)];
                }
                shuffledBots.forEach((botName, i) => {
                    submissions.push({ id: i + 2, playerName: botName, punchline: botPunchlines[i] || botPunchlines[0] });
                });

                const aiResult = await pickWinnerWithAI(submissions, prompt, 'general');
                const winnerId = aiResult.winnerId || 1;
                const playerWon = winnerId === 1;
                const timeTaken = (Date.now() - startTime) / 1000;

                let score = playerWon ? 100 : 0;
                score += Math.max(0, Math.floor(50 - timeTaken));
                let profile = await getProfile(playerId);
                if (profile) {
                    const yesterday = new Date(Date.now() - 86400000);
                    const yesterdayKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth()+1).padStart(2,'0')}-${String(yesterday.getUTCDate()).padStart(2,'0')}`;
                    if (profile.lastDailyDate === yesterdayKey) profile.dailyChallengeStreak++;
                    else if (profile.lastDailyDate !== dateKey) profile.dailyChallengeStreak = 1;
                    score += profile.dailyChallengeStreak * 10;
                    profile.lastDailyDate = dateKey;
                    profile.lifetimeXP += score;
                    if (playerWon) profile.roundsWon++;
                    const newAchievements = checkAchievements(profile);
                    await saveProfile(profile);
                    await redisSet(`daily:${dateKey}:played:${playerId}`, true, 86400 * 2);
                    const lb = await redisGet(`daily:${dateKey}:lb`) || [];
                    lb.push({ name: playerName, score, won: playerWon, time: Math.round(timeTaken) });
                    lb.sort((a, b) => b.score - a.score);
                    await redisSet(`daily:${dateKey}:lb`, lb.slice(0, 100), 86400 * 2);
                    return res.status(200).json({
                        success: true,
                        result: {
                            won: playerWon, score, prompt, punchline, winnerId,
                            winnerName: submissions.find(s => s.id === winnerId)?.playerName,
                            winningPunchline: submissions.find(s => s.id === winnerId)?.punchline,
                            aiCommentary: aiResult.aiCommentary, streak: profile.dailyChallengeStreak,
                            leaderboard: lb.slice(0, 20), newAchievements, profile
                        }
                    });
                }
                return res.status(200).json({ success: true, result: { won: playerWon, score, prompt, winnerId } });
            }

            case 'createChallenge': {
                const { creatorName, category } = body;
                const prompt = sanitizeInput(body.prompt);
                if (!creatorName || !prompt) return res.status(400).json({ error: 'creatorName and prompt required' });
                if (prompt.length > 150) return res.status(400).json({ error: 'Prompt too long (max 150 characters)' });
                const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'general';
                const challengeId = Math.random().toString(36).substring(2, 10);
                await redisSet(`challenge:${challengeId}`, { creatorName, creatorScore: 0, prompt, category: safeCategory, createdAt: Date.now() }, 86400 * 7);
                return res.status(200).json({ success: true, challengeId });
            }

            case 'getChallenge': {
                const challengeId = req.query.id || body.challengeId;
                if (!challengeId) return res.status(400).json({ error: 'challengeId required' });
                const challenge = await redisGet(`challenge:${challengeId}`);
                if (!challenge) return res.status(404).json({ error: 'Challenge not found or expired' });
                return res.status(200).json({ success: true, challenge });
            }

            case 'appealVerdict': {
                const { roomId, playerName, roundIndex, playerId } = body;
                let room = await getRoom(roomId);
                if (!room) return res.status(404).json({ error: 'Room not found' });
                if (room.status !== 'roundResults') return res.status(400).json({ error: 'Not in results phase' });

                const result = room.roundResults[roundIndex !== undefined ? roundIndex : room.roundResults.length - 1];
                if (!result) return res.status(400).json({ error: 'No round result to appeal' });
                if (result.appealed) return res.status(400).json({ error: 'Already appealed' });

                if (!playerId) return res.status(400).json({ error: 'playerId required for appeals' });
                const profile = await getProfile(playerId);
                if (profile && profile.lifetimeXP < 50) return res.status(400).json({ error: 'Need 50 XP to appeal' });

                const submissions = room.submissions;
                const [glAppeal, reJudgeResult] = await Promise.all([
                    appealWithGenLayer(room.id, room.jokePrompt, room.category, submissions, result.winnerId).catch(() => null),
                    pickWinnerWithAI(submissions, room.jokePrompt, room.category).catch(() => ({ winnerId: null }))
                ]);

                let appealOnChain = false, appealTxHash = null;
                if (glAppeal?.txHash) { appealOnChain = true; appealTxHash = glAppeal.txHash; }

                const newWinnerId = reJudgeResult.winnerId;
                const overturned = newWinnerId && newWinnerId !== result.winnerId;

                result.appealed = true;
                result.appealResult = overturned ? 'overturned' : 'upheld';
                result.appealNewWinnerId = newWinnerId;

                if (overturned) {
                    const oldWinner = room.players.find(p => p.name === result.winnerName);
                    if (oldWinner) oldWinner.score = Math.max(0, oldWinner.score - 100);
                    const newWinnerSub = submissions.find(s => s.id === newWinnerId);
                    if (newWinnerSub) {
                        const nwp = room.players.find(p => p.name === newWinnerSub.playerName);
                        if (nwp) nwp.score += 100;
                        result.appealNewWinnerName = newWinnerSub.playerName;
                        result.appealNewPunchline = newWinnerSub.punchline;
                    }
                } else if (playerId) {
                    const profile = await getProfile(playerId);
                    if (profile) { profile.lifetimeXP = Math.max(0, profile.lifetimeXP - 50); await saveProfile(profile); }
                }

                result.appealOnChain = appealOnChain;
                result.appealTxHash = appealTxHash;
                await setRoom(roomId, room);
                return res.status(200).json({
                    success: true,
                    appeal: { overturned, newWinnerId, oldWinnerId: result.winnerId, onChain: appealOnChain, txHash: appealTxHash },
                    room
                });
            }

            case 'ogPreview': {
                const shareId = req.query.id;
                if (!shareId) return res.status(400).json({ error: 'id required' });
                if (!/^[a-z0-9]{6,12}$/i.test(shareId)) return res.status(400).json({ error: 'Invalid share ID format' });
                const shareData = await redisGet(`share:${shareId}`);
                const title = shareData?.winnerName ? `${shareData.winnerName} won Oracle of Wit!` : 'Oracle of Wit - GenLayer Game';
                const desc = shareData?.punchline || 'The AI humor prediction game powered by GenLayer';
                const url = 'https://oracle-of-wit.vercel.app';
                const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
                const html = `<!DOCTYPE html><html><head>
                    <meta property="og:title" content="${esc(title)}" />
                    <meta property="og:description" content="${esc(desc)}" />
                    <meta property="og:image" content="${url}/og-image.png" />
                    <meta property="og:url" content="${url}/share/${esc(shareId)}" />
                    <meta name="twitter:card" content="summary_large_image" />
                    <meta name="twitter:title" content="${esc(title)}" />
                    <meta name="twitter:description" content="${esc(desc)}" />
                    <meta http-equiv="refresh" content="0; url=${url}" />
                </head><body>Redirecting...</body></html>`;
                res.setHeader('Content-Type', 'text/html');
                return res.status(200).send(html);
            }

            case 'createShare': {
                const { winnerName, punchline, prompt, score, category } = body;
                const shareId = Math.random().toString(36).substring(2, 10);
                await redisSet(`share:${shareId}`, { winnerName, punchline, prompt, score, category, createdAt: Date.now() }, 86400 * 30);
                return res.status(200).json({ success: true, shareId });
            }

            case 'getHallOfFame': {
                const hof = await redisGet('hall_of_fame') || [];
                return res.status(200).json({ success: true, hallOfFame: hof });
            }

            case 'getSeasonalLeaderboard': {
                const season = body.season || req.query.season || getCurrentSeasonKey();
                const slb = await redisGet(`leaderboard:${season}`) || [];
                return res.status(200).json({ success: true, season, leaderboard: slb.slice(0, 50) });
            }

            case 'getPlayerHistory': {
                const playerName = body.playerName || req.query.playerName;
                if (!playerName) return res.status(400).json({ error: 'playerName required' });

                const client = await getGenLayerClient();
                if (!client) {
                    const lb = await _getLeaderboard();
                    const entry = lb.find(p => p.name === playerName);
                    return res.status(200).json({ success: true, source: 'redis', history: { player_name: playerName, total_score: entry?.totalScore || 0, games_played: entry?.gamesPlayed || 0, games: [] } });
                }
                try {
                    const result = await client.readContract({ address: GENLAYER_CONTRACT_ADDRESS, functionName: 'get_player_history', args: [playerName] });
                    return res.status(200).json({ success: true, source: 'genlayer', history: result });
                } catch (err) {
                    const lb = await _getLeaderboard();
                    const entry = lb.find(p => p.name === playerName);
                    return res.status(200).json({ success: true, source: 'redis_fallback', history: { player_name: playerName, total_score: entry?.totalScore || 0, games_played: entry?.gamesPlayed || 0, games: [] } });
                }
            }

            case 'getSeasonArchive': {
                const seasonId = body.seasonId || req.query.seasonId;
                if (!seasonId) return res.status(400).json({ error: 'seasonId required' });
                const client = await getGenLayerClient();
                if (!client) return res.status(200).json({ success: true, source: 'unavailable', archive: null });
                try {
                    const result = await client.readContract({ address: GENLAYER_CONTRACT_ADDRESS, functionName: 'get_season', args: [seasonId] });
                    return res.status(200).json({ success: true, source: 'genlayer', archive: result });
                } catch (err) {
                    return res.status(200).json({ success: true, source: 'error', archive: null });
                }
            }

            case 'submitPrompt': {
                const { playerId } = body;
                const playerName = sanitizeInput(body.playerName);
                const userPrompt = sanitizeInput(body.prompt);
                if (!playerName || !userPrompt) return res.status(400).json({ error: 'playerName and prompt required' });
                if (playerName.length > 30) return res.status(400).json({ error: 'Player name too long (max 30 characters)' });
                if (userPrompt.length < 10 || userPrompt.length > 150) return res.status(400).json({ error: 'Prompt must be 10-150 characters' });

                const prompts = await redisGet('community_prompts') || [];
                if (prompts.some(p => p.playerId === playerId && Date.now() - p.createdAt < 86400000)) return res.status(400).json({ error: 'One submission per day' });
                const promptId = Math.random().toString(36).substring(2, 10);
                prompts.push({ id: promptId, prompt: userPrompt, author: playerName, playerId, votes: 0, voters: [], status: 'pending', createdAt: Date.now() });
                await redisSet('community_prompts', prompts, 86400 * 90);
                return res.status(200).json({ success: true, promptId });
            }

            case 'votePrompt': {
                const { promptId, playerId } = body;
                if (!promptId || !playerId) return res.status(400).json({ error: 'promptId and playerId required' });
                const prompts = await redisGet('community_prompts') || [];
                const prompt = prompts.find(p => p.id === promptId);
                if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
                if (prompt.playerId === playerId) return res.status(400).json({ error: 'Cannot vote for your own prompt' });
                if (prompt.voters.includes(playerId)) return res.status(400).json({ error: 'Already voted' });
                prompt.votes++;
                prompt.voters.push(playerId);
                if (prompt.votes >= 5 && prompt.status === 'pending') prompt.status = 'approved';
                await redisSet('community_prompts', prompts, 86400 * 90);
                return res.status(200).json({ success: true, votes: prompt.votes, status: prompt.status });
            }

            case 'getPromptSubmissions': {
                const prompts = await redisGet('community_prompts') || [];
                return res.status(200).json({ success: true, prompts: [...prompts].sort((a, b) => b.votes - a.votes).slice(0, 50) });
            }

            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
    } catch (error) {
        console.error(`[API Error] action=${action} roomId=${body.roomId || 'N/A'} error=${String(error.message).slice(0, 200)}`);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
