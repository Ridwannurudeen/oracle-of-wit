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
    const p = state.profile;
    const nextXP = state.nextLevelXP;
    const currentLevelXP = [0,0,500,1500,3000,6000,10000,20000,40000,75000,150000][p.level] || 0;
    const progress = nextXP ? Math.min(100, ((p.lifetimeXP - currentLevelXP) / (nextXP - currentLevelXP)) * 100) : 100;
    return html`
        <div class="glow-card p-4">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 oracle-eye rounded-full flex items-center justify-center text-xl font-display font-bold">${p.level}</div>
                    <div>
                        <p class="font-display font-bold text-white tracking-wider">${p.name}</p>
                        <p class="text-sm font-mono text-wit">${p.title}</p>
                    </div>
                </div>
                <button data-action="goToProfile" class="btn btn-ghost text-xs px-3 py-1.5 rounded-lg" aria-label="View profile">PROFILE</button>
            </div>
            <div class="flex justify-between text-[10px] font-mono text-gray-500 mb-1 tracking-wider">
                <span>${raw(p.lifetimeXP.toLocaleString())} XP</span>
                <span>${raw(nextXP ? nextXP.toLocaleString() + ' XP' : 'MAX LEVEL')}</span>
            </div>
            <div class="h-2.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                <div class="h-full xp-bar" style="width:${raw(String(progress))}%"></div>
            </div>
            <div class="flex justify-between mt-2 text-[10px] font-mono text-gray-600 tracking-wider">
                <span>${raw(String(p.gamesPlayed))} GAMES</span>
                <span>${raw(String(p.gamesWon))} WINS</span>
                <span>${raw(String(p.roundsWon))} ROUNDS</span>
            </div>
            ${raw(p.achievements.length > 0 ? `<div class="flex flex-wrap gap-1 mt-2">${p.achievements.slice(0,8).map(aId => {
                const a = state.allAchievements.find(x=>x.id===aId);
                return a ? `<span title="${esc(a.name)}" class="text-lg">${esc(a.icon)}</span>` : '';
            }).join('')}${p.achievements.length > 8 ? `<span class="text-xs text-gray-500">+${p.achievements.length-8}</span>` : ''}</div>` : '')}
        </div>`;
}

/**
 * Render the countdown timer HTML fragment.
 * @returns {string} HTML string for the timer, or empty string if no time left.
 */
export function renderTimer() {
    if (state.timeLeft <= 0) return '';
    const isLow = state.timeLeft <= 10;
    const max = state.screen === 'submitting' ? 40 : state.screen === 'voting' ? 20 : 30;
    const pct = (state.timeLeft / max) * 100;
    return html`
        <div class="glow-card ${raw(isLow ? 'glow-card-red' : '')} p-4 mb-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[10px] font-mono text-gray-500 tracking-widest uppercase">TIMER</span>
                <span id="timer-display" role="timer" aria-label="Time remaining" class="text-3xl font-mono font-bold ${raw(isLow ? 'countdown-critical text-red-500' : 'text-white')}">${raw(formatTime(state.timeLeft))}</span>
            </div>
            <div class="h-2 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                <div id="timer-bar" class="h-full timer-bar rounded-full ${raw(isLow ? 'bg-red-500' : 'bg-gradient-to-r from-wit to-oracle')}" style="width:${raw(String(pct))}%"></div>
            </div>
            <p id="timer-warning" class="text-red-400 text-xs font-mono mt-2 text-center animate-pulse tracking-wider" style="display:${raw(isLow ? 'block' : 'none')}">TIME CRITICAL</p>
        </div>
    `;
}
