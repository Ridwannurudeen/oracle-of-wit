// Oracle of Wit — Render Helpers & Shared Fragments (ES Module)

import { state, gameEvents } from './state.js';

/**
 * Format seconds as M:SS.
 * @param {number} s - Seconds to format.
 * @returns {string} Formatted time string.
 */
export function formatTime(s) {
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
}

/**
 * Escape a string for safe HTML insertion (prevents XSS).
 * @param {string|null|undefined} str - User-supplied content.
 * @returns {string} HTML-escaped string.
 */
export function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

/**
 * Tagged template literal that auto-escapes all interpolated values.
 * Use `raw()` to pass through pre-escaped HTML without double-escaping.
 * @param {TemplateStringsArray} strings - Static template parts.
 * @param {...*} values - Interpolated values to escape.
 * @returns {string} Safe HTML string.
 */
export function html(strings, ...values) {
    return strings.reduce((result, str, i) => {
        const val = i < values.length ? values[i] : '';
        // If value is already marked safe (raw HTML), don't escape
        if (val && val.__safe) return result + str + val.value;
        return result + str + esc(String(val ?? ''));
    }, '');
}

/**
 * Mark a string as safe (pre-escaped HTML) so `html` tag won't escape it.
 * @param {string} str - Already-safe HTML content.
 * @returns {{ __safe: true, value: string }}
 */
export function raw(str) {
    return { __safe: true, value: str };
}

/**
 * Render the GenLayer logo as an inline SVG string.
 * @param {number} [size=16] - Width and height in pixels.
 * @param {string} [color='currentColor'] - Fill colour.
 * @returns {string} SVG markup.
 */
export function glLogo(size = 16, color = 'currentColor') {
    return `<svg viewBox="0 0 97.76 91.93" width="${size}" height="${size}" fill="${color}" xmlns="http://www.w3.org/2000/svg"><polygon points="44.26 32.35 27.72 67.12 43.29 74.9 0 91.93 44.26 0 44.26 32.35"/><polygon points="53.5 32.35 70.04 67.12 54.47 74.9 97.76 91.93 53.5 0 53.5 32.35"/><polygon points="48.64 43.78 58.33 62.94 48.64 67.69 39.47 62.92 48.64 43.78" opacity="0.3"/></svg>`;
}

/**
 * Push a live game event into the HUD wing event list (max 8).
 * @param {string} type - Event category (e.g. 'round', 'phase', 'oracle').
 * @param {string} text - Human-readable event description.
 * @returns {void}
 */
export function addGameEvent(type, text) {
    gameEvents.unshift({ type, text, time: Date.now() });
    if (gameEvents.length > 8) gameEvents.pop();
}

/**
 * Format a timestamp as a relative time string (e.g. "just now", "5s ago").
 * @param {number} ts - Unix timestamp in milliseconds.
 * @returns {string} Relative time label.
 */
export function formatEventTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return 'earlier';
}

/**
 * Get the next XP threshold needed for leveling up (client-side).
 * @param {number} xp - Current lifetime XP.
 * @returns {number|null} Next level threshold, or null if already max.
 */
export function getNextLevelXPClient(xp) {
    const thresholds = [0,500,1500,3000,6000,10000,20000,40000,75000,150000];
    for (const t of thresholds) {
        if (xp < t) return t;
    }
    return null;
}

/**
 * Get today's date as a UTC YYYY-MM-DD key string (client-side).
 * @returns {string} Date key, e.g. "2026-03-19".
 */
export function getTodayKeyClient() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// === SHARED RENDER FRAGMENTS ===

/**
 * Render the player profile card HTML fragment.
 * @returns {string} HTML string for the profile card, or empty string if no profile.
 */
export function renderProfileCard() {
    if (!state.profile) return '';
    return '<div data-island="profile-card"></div>';
}

/**
 * Render the countdown timer HTML fragment.
 * @returns {string} HTML string for the timer, or empty string if no time left.
 */
export function renderTimer() {
    if (state.timeLeft <= 0) return '';
    const max = state.screen === 'submitting' ? 40 : state.screen === 'voting' ? 20 : 30;
    return `<div data-island="timer" data-max-time="${max}" class="glow-card p-4 mb-4"></div>`;
}
