// Oracle of Wit — Render Helpers & Shared Fragments (ES Module)

import { state, gameEvents } from './state.js';

// Format time as M:SS
export function formatTime(s) {
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
}

// Prevent XSS from user-supplied content
export function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

// GenLayer logo SVG (from studio.genlayer.com)
export function glLogo(size = 16, color = 'currentColor') {
    return `<svg viewBox="0 0 97.76 91.93" width="${size}" height="${size}" fill="${color}" xmlns="http://www.w3.org/2000/svg"><polygon points="44.26 32.35 27.72 67.12 43.29 74.9 0 91.93 44.26 0 44.26 32.35"/><polygon points="53.5 32.35 70.04 67.12 54.47 74.9 97.76 91.93 53.5 0 53.5 32.35"/><polygon points="48.64 43.78 58.33 62.94 48.64 67.69 39.47 62.92 48.64 43.78" opacity="0.3"/></svg>`;
}

// === HUD WING HELPERS ===
export function addGameEvent(type, text) {
    gameEvents.unshift({ type, text, time: Date.now() });
    if (gameEvents.length > 8) gameEvents.pop();
}

export function formatEventTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return 'earlier';
}

export function getTodayKeyClient() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// === SHARED RENDER FRAGMENTS ===

export function renderProfileCard() {
    if (!state.profile) return '';
    const p = state.profile;
    const nextXP = state.nextLevelXP;
    const currentLevelXP = [0,0,500,1500,3000,6000,10000,20000,40000,75000,150000][p.level] || 0;
    const progress = nextXP ? Math.min(100, ((p.lifetimeXP - currentLevelXP) / (nextXP - currentLevelXP)) * 100) : 100;
    return `
        <div class="glow-card p-4">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 oracle-eye rounded-full flex items-center justify-center text-xl font-display font-bold">${p.level}</div>
                    <div>
                        <p class="font-display font-bold text-white tracking-wider">${esc(p.name)}</p>
                        <p class="text-sm font-mono text-wit">${esc(p.title)}</p>
                    </div>
                </div>
                <button data-action="goToProfile" class="btn btn-ghost text-xs px-3 py-1.5 rounded-lg">PROFILE</button>
            </div>
            <div class="flex justify-between text-[10px] font-mono text-gray-500 mb-1 tracking-wider">
                <span>${p.lifetimeXP.toLocaleString()} XP</span>
                <span>${nextXP ? nextXP.toLocaleString() + ' XP' : 'MAX LEVEL'}</span>
            </div>
            <div class="h-2.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                <div class="h-full xp-bar" style="width:${progress}%"></div>
            </div>
            <div class="flex justify-between mt-2 text-[10px] font-mono text-gray-600 tracking-wider">
                <span>${p.gamesPlayed} GAMES</span>
                <span>${p.gamesWon} WINS</span>
                <span>${p.roundsWon} ROUNDS</span>
            </div>
            ${p.achievements.length > 0 ? `<div class="flex flex-wrap gap-1 mt-2">${p.achievements.slice(0,8).map(aId => {
                const a = state.allAchievements.find(x=>x.id===aId);
                return a ? `<span title="${esc(a.name)}" class="text-lg">${esc(a.icon)}</span>` : '';
            }).join('')}${p.achievements.length > 8 ? `<span class="text-xs text-gray-500">+${p.achievements.length-8}</span>` : ''}</div>` : ''}
        </div>`;
}

export function renderTimer() {
    if (state.timeLeft <= 0) return '';
    const isLow = state.timeLeft <= 10;
    const max = state.screen === 'submitting' ? 40 : state.screen === 'voting' ? 20 : 30;
    const pct = (state.timeLeft / max) * 100;
    return `
        <div class="glow-card ${isLow ? 'glow-card-red' : ''} p-4 mb-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[10px] font-mono text-gray-500 tracking-widest uppercase">TIMER</span>
                <span id="timer-display" class="text-3xl font-mono font-bold ${isLow ? 'countdown-critical text-red-500' : 'text-white'}">${formatTime(state.timeLeft)}</span>
            </div>
            <div class="h-2 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                <div id="timer-bar" class="h-full timer-bar rounded-full ${isLow ? 'bg-red-500' : 'bg-gradient-to-r from-wit to-oracle'}" style="width:${pct}%"></div>
            </div>
            <p id="timer-warning" class="text-red-400 text-xs font-mono mt-2 text-center animate-pulse tracking-wider" style="display:${isLow ? 'block' : 'none'}">TIME CRITICAL</p>
        </div>
    `;
}
