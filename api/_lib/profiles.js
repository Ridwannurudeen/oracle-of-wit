// Player profiles, daily challenges, leaderboard helpers

import { redisGet, redisSet, redisSetNX, redisDel } from './redis.js';
import { LEVEL_THRESHOLDS, ACHIEVEMENTS, PROMPT_PUNCHLINES, FALLBACK_PUNCHLINES, CATEGORIZED_PROMPTS } from './constants.js';
import { logger } from './logger.js';
import { tursoGetProfile, tursoSaveProfile, tursoUpdateLeaderboard } from './turso.js';

/**
 * Get the level info for a given XP amount.
 * @param {number} xp
 * @returns {import('./types.js').LevelThreshold}
 */
export function getLevelForXP(xp) {
    let result = LEVEL_THRESHOLDS[0];
    for (const t of LEVEL_THRESHOLDS) {
        if (xp >= t.xp) result = t;
    }
    return result;
}

/**
 * Get the XP threshold for the next level.
 * @param {number} xp
 * @returns {number|null} The next level's XP threshold, or null if max level.
 */
export function getNextLevelXP(xp) {
    for (const t of LEVEL_THRESHOLDS) {
        if (xp < t.xp) return t.xp;
    }
    return null;
}

/**
 * Retrieve a player profile. Redis first, Turso fallback.
 * @param {string} playerId
 * @returns {Promise<import('./types.js').Profile|null>}
 */
export async function getProfile(playerId) {
    const cached = await redisGet(`player:${playerId}`);
    if (cached) return cached;
    // Turso fallback — rehydrate Redis cache on hit
    const persisted = await tursoGetProfile(playerId);
    if (persisted) {
        const level = getLevelForXP(persisted.lifetimeXP);
        persisted.level = level.level;
        persisted.title = level.title;
        await redisSet(`player:${playerId}`, persisted, 86400 * 365);
    }
    return persisted;
}

/**
 * Save a player profile to Redis + Turso (auto-calculates level/title).
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<void>}
 */
export async function saveProfile(profile) {
    const level = getLevelForXP(profile.lifetimeXP);
    profile.level = level.level;
    profile.title = level.title;
    await redisSet(`player:${profile.id}`, profile, 86400 * 365);
    // Fire-and-forget Turso write (non-blocking)
    tursoSaveProfile(profile).catch(() => {});
}

/**
 * Create a default player profile with initial values.
 * @param {string} playerId
 * @param {string} playerName
 * @returns {import('./types.js').Profile}
 */
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

/**
 * Check and award new achievements based on profile stats.
 * @param {import('./types.js').Profile} profile
 * @param {{perfectGame?: boolean, comeback?: boolean}} [extraContext={}]
 * @returns {string[]} Array of newly earned achievement IDs.
 */
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

/**
 * Get today's date as a UTC key string (YYYY-MM-DD).
 * @returns {string}
 */
export function getTodayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

/**
 * Get the deterministic daily challenge prompt based on the current date.
 * @returns {string}
 */
export function getDailyPrompt() {
    const allPrompts = [...CATEGORIZED_PROMPTS.tech, ...CATEGORIZED_PROMPTS.crypto, ...CATEGORIZED_PROMPTS.general];
    const today = new Date();
    const dayNum = Math.floor(today.getTime() / 86400000);
    return allPrompts[dayNum % allPrompts.length];
}

/**
 * Get the current season key (YYYY-MM).
 * @returns {string}
 */
export function getCurrentSeasonKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

/**
 * Get the global leaderboard from Redis.
 * @returns {Promise<import('./types.js').LeaderboardEntry[]>}
 */
export async function getLeaderboard() {
    return await redisGet('leaderboard') || [];
}

/**
 * Set the global leaderboard in Redis.
 * @param {import('./types.js').LeaderboardEntry[]} lb
 * @returns {Promise<void>}
 */
export async function setLeaderboard(lb) {
    await redisSet('leaderboard', lb);
}

/**
 * Update a player's entry on the global and seasonal leaderboards.
 * @param {string} playerName
 * @param {number} score
 * @param {boolean} isBot
 * @returns {Promise<void>}
 */
export async function updateLeaderboard(playerName, score, isBot) {
    if (isBot) return;

    // Acquire lock to prevent concurrent read-modify-write corruption
    const lockAcquired = await redisSetNX('lock:lb', 1, 10);
    if (!lockAcquired) {
        logger.warn('Lock busy, skipping update (next round will catch up)', { service: 'leaderboard' });
        return;
    }

    try {
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

        // Fire-and-forget Turso write for both global and seasonal
        tursoUpdateLeaderboard(playerName, score, 'all-time').catch(() => {});
        tursoUpdateLeaderboard(playerName, score, seasonKey).catch(() => {});
    } finally {
        await redisDel('lock:lb');
    }
}
