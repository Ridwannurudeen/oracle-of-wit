// Turso persistent storage — write-through cache alongside Redis

import { logger } from './logger.js';

/** @type {import('@libsql/client').Client|null} */
let _client = null;

/** @type {boolean} */
let _initAttempted = false;

/**
 * Initialize the Turso client (async, call once at startup).
 * @returns {Promise<import('@libsql/client').Client|null>}
 */
export async function initTursoClient() {
    if (_client) return _client;
    if (_initAttempted) return null;
    _initAttempted = true;
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) return null;
    try {
        const { createClient } = await import('@libsql/client');
        _client = createClient({ url, authToken });
        return _client;
    } catch (e) {
        logger.warn('Turso client init failed', { service: 'turso', error: e.message });
        return null;
    }
}

/**
 * Get the Turso client singleton (must call initTursoClient first).
 * Returns null when not initialized or env vars missing.
 * @returns {import('@libsql/client').Client|null}
 */
export function getTursoClient() {
    return _client;
}

/** @type {boolean} */
let _initialized = false;

/**
 * Run schema migrations (idempotent — safe to call on every cold start).
 * @returns {Promise<void>}
 */
export async function initTursoSchema() {
    if (_initialized) return;
    const client = await initTursoClient();
    if (!client) return;

    try {
        await client.batch([
            `CREATE TABLE IF NOT EXISTS users (
                wallet_address TEXT PRIMARY KEY,
                legacy_id TEXT UNIQUE,
                display_name TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
                last_seen_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
            )`,
            `CREATE TABLE IF NOT EXISTS profiles (
                user_id TEXT PRIMARY KEY,
                lifetime_xp INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 1,
                title TEXT NOT NULL DEFAULT 'Joke Rookie',
                games_played INTEGER NOT NULL DEFAULT 0,
                games_won INTEGER NOT NULL DEFAULT 0,
                rounds_won INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                total_correct_bets INTEGER NOT NULL DEFAULT 0,
                achievements TEXT NOT NULL DEFAULT '[]',
                daily_challenge_streak INTEGER NOT NULL DEFAULT 0,
                last_daily_date TEXT,
                last_played_at INTEGER,
                updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
            )`,
            `CREATE TABLE IF NOT EXISTS game_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                player_id TEXT,
                player_name TEXT NOT NULL,
                category TEXT,
                rounds_total INTEGER,
                rounds_won INTEGER NOT NULL DEFAULT 0,
                score INTEGER NOT NULL DEFAULT 0,
                placement INTEGER,
                is_winner INTEGER NOT NULL DEFAULT 0,
                played_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
            )`,
            `CREATE TABLE IF NOT EXISTS leaderboard_entries (
                player_name TEXT NOT NULL,
                season TEXT NOT NULL,
                total_score INTEGER NOT NULL DEFAULT 0,
                games_played INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
                PRIMARY KEY (player_name, season)
            )`,
        ]);
        _initialized = true;
        logger.info('Turso schema initialized', { service: 'turso' });
    } catch (e) {
        logger.warn('Turso schema init failed', { service: 'turso', error: e.message });
    }
}

// ── Profile Operations ─────────────────────────────────────────

/**
 * Get a profile from Turso by user ID.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function tursoGetProfile(userId) {
    const client = getTursoClient();
    if (!client) return null;
    try {
        const result = await client.execute({
            sql: 'SELECT * FROM profiles WHERE user_id = ?',
            args: [userId],
        });
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.user_id,
            lifetimeXP: row.lifetime_xp,
            level: row.level,
            title: row.title,
            gamesPlayed: row.games_played,
            gamesWon: row.games_won,
            roundsWon: row.rounds_won,
            bestStreak: row.best_streak,
            totalCorrectBets: row.total_correct_bets,
            achievements: JSON.parse(row.achievements || '[]'),
            dailyChallengeStreak: row.daily_challenge_streak,
            lastDailyDate: row.last_daily_date,
            lastPlayedAt: row.last_played_at,
        };
    } catch (e) {
        logger.warn('Turso getProfile failed', { service: 'turso', userId, error: e.message });
        return null;
    }
}

/**
 * Upsert a profile into Turso.
 * @param {Object} profile
 * @returns {Promise<boolean>}
 */
export async function tursoSaveProfile(profile) {
    const client = getTursoClient();
    if (!client) return false;
    try {
        await client.execute({
            sql: `INSERT INTO profiles (user_id, lifetime_xp, level, title, games_played, games_won, rounds_won, best_streak, total_correct_bets, achievements, daily_challenge_streak, last_daily_date, last_played_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    lifetime_xp=excluded.lifetime_xp, level=excluded.level, title=excluded.title,
                    games_played=excluded.games_played, games_won=excluded.games_won,
                    rounds_won=excluded.rounds_won, best_streak=excluded.best_streak,
                    total_correct_bets=excluded.total_correct_bets, achievements=excluded.achievements,
                    daily_challenge_streak=excluded.daily_challenge_streak, last_daily_date=excluded.last_daily_date,
                    last_played_at=excluded.last_played_at, updated_at=excluded.updated_at`,
            args: [
                profile.id, profile.lifetimeXP, profile.level, profile.title,
                profile.gamesPlayed, profile.gamesWon, profile.roundsWon,
                profile.bestStreak, profile.totalCorrectBets,
                JSON.stringify(profile.achievements || []),
                profile.dailyChallengeStreak, profile.lastDailyDate,
                profile.lastPlayedAt, Date.now(),
            ],
        });
        return true;
    } catch (e) {
        logger.warn('Turso saveProfile failed', { service: 'turso', userId: profile.id, error: e.message });
        return false;
    }
}

// ── Game History ────────────────────────────────────────────────

/**
 * Record a completed game for all players.
 * @param {string} roomId
 * @param {Object} room - The finished room object.
 * @returns {Promise<void>}
 */
export async function tursoRecordGameHistory(roomId, room) {
    const client = getTursoClient();
    if (!client) return;
    try {
        const standings = [...room.players].sort((a, b) => b.score - a.score);
        const winnerName = standings[0]?.name;
        const stmts = standings.map((p, i) => ({
            sql: `INSERT INTO game_history (room_id, player_name, category, rounds_total, rounds_won, score, placement, is_winner, played_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                roomId, p.name, room.category || 'general', room.totalRounds || 5,
                (room.roundResults || []).filter(r => r.winnerName === p.name).length,
                p.score, i + 1, p.name === winnerName ? 1 : 0, Date.now(),
            ],
        }));
        await client.batch(stmts);
    } catch (e) {
        logger.warn('Turso recordGameHistory failed', { service: 'turso', roomId, error: e.message });
    }
}

// ── Leaderboard ────────────────────────────────────────────────

/**
 * Upsert a player's leaderboard entry in Turso.
 * @param {string} playerName
 * @param {number} score
 * @param {string} season
 * @returns {Promise<void>}
 */
export async function tursoUpdateLeaderboard(playerName, score, season) {
    const client = getTursoClient();
    if (!client) return;
    try {
        await client.execute({
            sql: `INSERT INTO leaderboard_entries (player_name, season, total_score, games_played, updated_at)
                  VALUES (?, ?, ?, 1, ?)
                  ON CONFLICT(player_name, season) DO UPDATE SET
                    total_score = total_score + excluded.total_score,
                    games_played = games_played + 1,
                    updated_at = excluded.updated_at`,
            args: [playerName, season, score, Date.now()],
        });
    } catch (e) {
        logger.warn('Turso updateLeaderboard failed', { service: 'turso', playerName, error: e.message });
    }
}

// ── User / Wallet ──────────────────────────────────────────────

/**
 * Upsert a user record (wallet or legacy).
 * @param {Object} opts
 * @param {string} [opts.walletAddress]
 * @param {string} [opts.legacyId]
 * @param {string} [opts.displayName]
 * @returns {Promise<boolean>}
 */
export async function tursoUpsertUser({ walletAddress, legacyId, displayName }) {
    const client = getTursoClient();
    if (!client) return false;
    try {
        await client.execute({
            sql: `INSERT INTO users (wallet_address, legacy_id, display_name, last_seen_at)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(wallet_address) DO UPDATE SET
                    display_name = COALESCE(excluded.display_name, display_name),
                    last_seen_at = excluded.last_seen_at`,
            args: [walletAddress || legacyId, legacyId, displayName, Date.now()],
        });
        return true;
    } catch (e) {
        logger.warn('Turso upsertUser failed', { service: 'turso', error: e.message });
        return false;
    }
}

/**
 * Find a user by wallet address.
 * @param {string} walletAddress
 * @returns {Promise<Object|null>}
 */
export async function tursoGetUserByWallet(walletAddress) {
    const client = getTursoClient();
    if (!client) return null;
    try {
        const result = await client.execute({
            sql: 'SELECT * FROM users WHERE wallet_address = ?',
            args: [walletAddress],
        });
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (e) {
        logger.warn('Turso getUserByWallet failed', { service: 'turso', error: e.message });
        return null;
    }
}
