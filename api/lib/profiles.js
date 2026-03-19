// Player profiles, daily challenges, leaderboard helpers

import { redisGet, redisSet, redisSetNX, redisDel } from './redis.js';
import { LEVEL_THRESHOLDS, ACHIEVEMENTS, PROMPT_PUNCHLINES, FALLBACK_PUNCHLINES } from './constants.js';

export function getLevelForXP(xp) {
    let result = LEVEL_THRESHOLDS[0];
    for (const t of LEVEL_THRESHOLDS) {
        if (xp >= t.xp) result = t;
    }
    return result;
}

export function getNextLevelXP(xp) {
    for (const t of LEVEL_THRESHOLDS) {
        if (xp < t.xp) return t.xp;
    }
    return null;
}

export async function getProfile(playerId) {
    return await redisGet(`player:${playerId}`);
}

export async function saveProfile(profile) {
    const level = getLevelForXP(profile.lifetimeXP);
    profile.level = level.level;
    profile.title = level.title;
    await redisSet(`player:${profile.id}`, profile, 86400 * 365);
}

export function createDefaultProfile(playerId, playerName) {
    return {
        id: playerId, name: playerName, createdAt: Date.now(),
        lifetimeXP: 0, level: 1, title: 'Joke Rookie',
        gamesPlayed: 0, gamesWon: 0, roundsWon: 0,
        bestStreak: 0, totalCorrectBets: 0,
        achievements: [], dailyChallengeStreak: 0,
        lastDailyDate: null, lastPlayedAt: Date.now()
    };
}

export function checkAchievements(profile, extraContext = {}) {
    const newAchievements = [];
    const has = id => profile.achievements.includes(id);
    if (!has('first_win') && profile.roundsWon >= 1) newAchievements.push('first_win');
    if (!has('five_wins') && profile.roundsWon >= 5) newAchievements.push('five_wins');
    if (!has('streak_3') && profile.bestStreak >= 3) newAchievements.push('streak_3');
    if (!has('streak_5') && profile.bestStreak >= 5) newAchievements.push('streak_5');
    if (!has('bet_master') && profile.totalCorrectBets >= 10) newAchievements.push('bet_master');
    if (!has('daily_7') && profile.dailyChallengeStreak >= 7) newAchievements.push('daily_7');
    if (!has('daily_30') && profile.dailyChallengeStreak >= 30) newAchievements.push('daily_30');
    if (!has('level_5') && profile.level >= 5) newAchievements.push('level_5');
    if (!has('level_10') && profile.level >= 10) newAchievements.push('level_10');
    if (!has('games_10') && profile.gamesPlayed >= 10) newAchievements.push('games_10');
    if (!has('games_50') && profile.gamesPlayed >= 50) newAchievements.push('games_50');
    if (!has('perfect_game') && extraContext.perfectGame) newAchievements.push('perfect_game');
    if (!has('comeback') && extraContext.comeback) newAchievements.push('comeback');
    profile.achievements.push(...newAchievements);
    return newAchievements;
}

export function getTodayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function getDailyPrompt() {
    const basePrompts = {
        tech: [
            "Why do programmers prefer dark mode? Because...",
            "How many programmers does it take to change a light bulb?",
            "Why do Java developers wear glasses? Because...",
            "A SQL query walks into a bar, walks up to two tables and asks...",
            "Why did the developer go broke?",
            "My code worked on the first try, which means...",
            "The senior dev looked at my PR and said...",
            "I deployed on Friday and then...",
            "The bug wasn't a bug, it was...",
            "Stack Overflow marked my question as duplicate because..."
        ],
        crypto: [
            "Why did Bitcoin break up with the dollar?",
            "How does a crypto bro propose?",
            "Why did the NFT go to therapy?",
            "WAGMI until...",
            "I bought the dip, but then...",
            "My portfolio is down 90% because...",
            "The whitepaper promised... but delivered...",
            "The gas fees were so high that...",
            "Diamond hands means...",
            "The airdrop was worth..."
        ],
        general: [
            "Why don't scientists trust atoms?",
            "The meeting could have been an email, but instead...",
            "My therapist said I need to stop...",
            "I'm not procrastinating, I'm...",
            "The secret to success is...",
            "Dating apps taught me that...",
            "My superpower would be...",
            "Life hack: instead of being productive...",
            "I told my boss I was late because...",
            "My New Year's resolution lasted until..."
        ]
    };
    const allPrompts = [...basePrompts.tech, ...basePrompts.crypto, ...basePrompts.general];
    const today = new Date();
    const dayNum = Math.floor(today.getTime() / 86400000);
    return allPrompts[dayNum % allPrompts.length];
}

export function getCurrentSeasonKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

export async function getLeaderboard(fallbackLeaderboard) {
    return await redisGet('leaderboard') || [...fallbackLeaderboard];
}

export async function setLeaderboard(lb, fallbackLeaderboard) {
    fallbackLeaderboard.length = 0;
    fallbackLeaderboard.push(...lb);
    await redisSet('leaderboard', lb);
}

export async function updateLeaderboard(playerName, score, isBot, fallbackLeaderboard) {
    if (isBot) return;

    // Acquire lock to prevent concurrent read-modify-write corruption
    const lockAcquired = await redisSetNX('lock:lb', 1, 10);
    if (!lockAcquired) {
        console.warn('[Leaderboard] Lock busy, skipping update (next round will catch up)');
        return;
    }

    try {
        const lb = await getLeaderboard(fallbackLeaderboard);
        const existing = lb.find(p => p.name === playerName);
        if (existing) {
            existing.totalScore += score;
            existing.gamesPlayed++;
        } else {
            lb.push({ name: playerName, totalScore: score, gamesPlayed: 1 });
        }
        lb.sort((a, b) => b.totalScore - a.totalScore);
        await setLeaderboard(lb.slice(0, 100), fallbackLeaderboard);

        const seasonKey = getCurrentSeasonKey();
        const slb = await redisGet(`leaderboard:${seasonKey}`) || [];
        const sexisting = slb.find(p => p.name === playerName);
        if (sexisting) {
            sexisting.totalScore += score;
            sexisting.gamesPlayed++;
        } else {
            slb.push({ name: playerName, totalScore: score, gamesPlayed: 1 });
        }
        slb.sort((a, b) => b.totalScore - a.totalScore);
        await redisSet(`leaderboard:${seasonKey}`, slb.slice(0, 100), 86400 * 90);
    } finally {
        await redisDel('lock:lb');
    }
}
