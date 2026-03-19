// Oracle of Wit — Main Render Dispatcher + HUD (ES Module)

import { state, gameEvents, renderPending, setRenderPending, lastRenderTime, setLastRenderTime, MIN_RENDER_INTERVAL } from './state.js';
import { esc, formatEventTime, glLogo } from './render-helpers.js';
import { isTyping, soundEnabled, updateTimerDisplay } from './api.js';
import { mountOracleEye, oracleEye3D, playScreenTransition } from './effects.js';
import { renderWelcome, renderLobby, renderWaiting } from './render-lobby.js';
import { renderSubmitting, renderCurating, renderVoting, renderBetting, renderJudging } from './render-game.js';
import { renderRevealing, renderRoundResults, renderFinalResults } from './render-results.js';
import { renderDailyChallenge, renderProfileScreen, renderHallOfFame, renderCommunityPrompts } from './render-screens.js';

// === HUD WING PANELS ===

export function renderLeftWingContent() {
    const events = gameEvents.slice(0, 5);
    return `
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-2 h-2 rounded-full bg-wit animate-pulse"></div>
                    <span class="text-[10px] font-mono text-gray-500 tracking-[0.2em]">LIVE ACTIVITY</span>
                </div>
                ${events.length > 0 ? events.map(ev => `
                    <div class="wing-event mb-2 py-1.5">
                        <p class="text-[11px] font-mono text-gray-400">${esc(ev.text)}</p>
                        <p class="text-[9px] font-mono text-gray-700">${formatEventTime(ev.time)}</p>
                    </div>
                `).join('') : `
                    <div class="text-center py-6">
                        <p class="text-[11px] font-mono text-gray-700">No activity yet</p>
                        <p class="text-[9px] font-mono text-gray-800 mt-1">Join a game to see live events</p>
                    </div>
                `}
                ${state.room ? `
                    <div class="mt-3 pt-3 border-t border-white/[0.04]">
                        <p class="text-[9px] font-mono text-gray-600 tracking-wider mb-2">ROOM LOG</p>
                        ${(state.room.players || []).slice(0, 4).map(p => `
                            <div class="flex items-center gap-1.5 mb-1">
                                <div class="w-1.5 h-1.5 rounded-full ${p.isBot ? 'bg-oracle/50' : 'bg-wit/50'}"></div>
                                <span class="text-[10px] font-mono text-gray-500 truncate">${esc(p.name)}</span>
                                ${p.isBot ? '<span class="text-[8px] text-oracle/40">BOT</span>' : ''}
                            </div>
                        `).join('')}
                        ${(state.room.players || []).length > 4 ? `<p class="text-[9px] text-gray-700 font-mono">+${state.room.players.length - 4} more</p>` : ''}
                    </div>
                ` : ''}
    `;
}

export function renderLeftWing() {
    return `
        <aside class="hidden lg:block hud-wing" style="width:250px;min-width:250px">
            <div data-hud="left-wing" class="glass-panel p-4 rounded-2xl">${renderLeftWingContent()}</div>
        </aside>
    `;
}

export function renderRightWingContent() {
    const r = state.room;
    const budget = r?.betBudgets?.[state.playerName];
    const players = r?.players || [];
    const topPlayers = [...players].sort((a, b) => b.score - a.score).slice(0, 5);
    return `
                <!-- Network Status -->
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span class="text-[10px] font-mono text-gray-500 tracking-[0.2em]">NETWORK STATUS</span>
                </div>
                <div class="space-y-2 mb-4">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-mono text-gray-600">PROTOCOL</span>
                        <span class="text-[10px] font-mono text-oracle flex items-center gap-1">${glLogo(11, 'rgb(45,212,191)')} GenLayer</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-mono text-gray-600">NETWORK</span>
                        <div class="flex items-center gap-1">
                            <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            <span class="text-[10px] font-mono text-green-400">TESTNET</span>
                        </div>
                    </div>
                    ${r ? `
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-mono text-gray-600">ROOM</span>
                            <span class="text-[10px] font-mono text-wit">${esc(r.id || '\u2014')}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-mono text-gray-600">PLAYERS</span>
                            <span class="text-[10px] font-mono text-white">${players.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-mono text-gray-600">ROUND</span>
                            <span class="text-[10px] font-mono text-white">${r.currentRound || 0}/${r.totalRounds || 5}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-mono text-gray-600">STATUS</span>
                            <span class="text-[10px] font-mono ${r.status === 'judging' ? 'text-oracle' : r.status === 'submitting' ? 'text-wit' : 'text-gray-400'}">${esc((r.status || 'IDLE').toUpperCase())}</span>
                        </div>
                    ` : `
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-mono text-gray-600">STATUS</span>
                            <span class="text-[10px] font-mono text-gray-500">IDLE</span>
                        </div>
                    `}
                </div>

                ${r && topPlayers.length > 0 ? `
                    <!-- Mini Leaderboard -->
                    <div class="border-t border-white/[0.04] pt-3 mb-3">
                        <p class="text-[9px] font-mono text-gray-600 tracking-wider mb-2">LEADERBOARD</p>
                        <div class="space-y-1.5">
                            ${topPlayers.map((p, i) => `
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-[10px] font-mono ${i === 0 ? 'text-consensus' : 'text-gray-600'}">${i + 1}.</span>
                                        <span class="text-[10px] font-mono ${p.name === state.playerName ? 'text-wit' : 'text-gray-400'} truncate max-w-[120px]">${esc(p.name)}</span>
                                    </div>
                                    <span class="text-[10px] font-mono font-bold ${i === 0 ? 'text-consensus' : 'text-gray-500'}">${p.score}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${budget !== undefined ? `
                    <!-- Betting Budget -->
                    <div class="border-t border-white/[0.04] pt-3">
                        <p class="text-[9px] font-mono text-gray-600 tracking-wider mb-2">BET BUDGET</p>
                        <div class="flex items-center justify-between">
                            <div class="h-2 flex-1 bg-obsidian rounded-full overflow-hidden border border-white/[0.04] mr-3">
                                <div class="h-full rounded-full ${budget <= 50 ? 'bg-red-500' : 'bg-gradient-to-r from-consensus to-consensus-dim'}" style="width:${Math.min(100, (budget / 300) * 100)}%"></div>
                            </div>
                            <span class="text-xs font-mono font-bold ${budget <= 50 ? 'text-red-400' : 'text-consensus'}">${budget}</span>
                        </div>
                    </div>
                ` : ''}

                ${state.profile ? `
                    <!-- Player Info -->
                    <div class="border-t border-white/[0.04] pt-3 mt-3">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full bg-wit/20 flex items-center justify-center text-[10px] font-mono font-bold text-wit">${state.profile.level}</div>
                            <div>
                                <p class="text-[10px] font-mono text-gray-400">${esc(state.profile.title)}</p>
                                <p class="text-[9px] font-mono text-gray-600">${state.profile.lifetimeXP?.toLocaleString()} XP</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
    `;
}

export function renderRightWing() {
    return `
        <aside class="hidden lg:block hud-wing" style="width:250px;min-width:250px">
            <div data-hud="right-wing" class="glass-panel p-4 rounded-2xl">${renderRightWingContent()}</div>
        </aside>
    `;
}

// === SCREEN DISPATCHER ===
export function renderScreen() {
    // Reveal phase intercepts roundResults
    if (state.revealPhase === 'revealing') return renderRevealing();
    switch (state.screen) {
        case 'welcome': return renderWelcome();
        case 'lobby': return renderLobby();
        case 'waiting': return renderWaiting();
        case 'submitting': return renderSubmitting();
        case 'curating': return renderCurating();
        case 'voting': return renderVoting();
        case 'betting': return renderBetting();
        case 'judging': return renderJudging();
        case 'roundResults': return renderRoundResults();
        case 'finished': return renderFinalResults();
        case 'daily': return renderDailyChallenge();
        case 'profile': return renderProfileScreen();
        case 'hallOfFame': return renderHallOfFame();
        case 'communityPrompts': return renderCommunityPrompts();
        default: return renderWelcome();
    }
}

// === MAIN RENDER ===
export function render(force = false) {
    // Skip render completely while typing (unless forced)
    // Also check if textarea is focused — isTyping timeout may have expired while user is still in the field
    const textareaFocused = document.activeElement?.id === 'punchline';
    if ((isTyping || textareaFocused) && !force) {
        updateTimerDisplay();
        return;
    }

    // Throttle renders to prevent freezing
    const now = Date.now();
    if (now - lastRenderTime < MIN_RENDER_INTERVAL && !force) {
        if (!renderPending) {
            setRenderPending(true);
            setTimeout(() => {
                setRenderPending(false);
                render();
            }, MIN_RENDER_INTERVAL);
        }
        return;
    }
    setLastRenderTime(now);

    // Preserve textarea focus and cursor position
    const activeEl = document.activeElement;
    const wasTextareaFocused = activeEl && activeEl.id === 'punchline';
    let selectionStart = 0, selectionEnd = 0;
    if (wasTextareaFocused) {
        selectionStart = activeEl.selectionStart;
        selectionEnd = activeEl.selectionEnd;
    }

    // Track screen transitions for sound + tab title
    const prevScreen = document.getElementById('app')?.dataset?.screen;
    if (prevScreen && prevScreen !== state.screen) {
        playScreenTransition(prevScreen, state.screen);
    }
    // Update tab title
    const phaseLabel = state.room ? `[R${state.room.currentRound || 0}] ${(state.screen || '').toUpperCase()}` : '';
    document.title = phaseLabel ? `${phaseLabel} - Oracle of Wit` : 'Oracle of Wit - GenLayer Community Game';

    const isHighStakes = state.room?.betBudgets?.[state.playerName] !== undefined && (state.room.betBudgets[state.playerName] ?? 300) <= 50;
    const appEl = document.getElementById('app');
    appEl.dataset.screen = state.screen;
    appEl.innerHTML = `
        <div class="${isHighStakes ? 'high-stakes' : ''}">
        <header id="main-header" class="py-2.5 px-4 border-b border-white/[0.04] sticky top-0 z-50 header-transition" style="background:rgba(5,5,5,0.88);backdrop-filter:blur(24px) saturate(1.2)">
            <div class="w-full flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div id="header-eye" class="w-8 h-8 oracle-eye rounded-full flex items-center justify-center shrink-0"></div>
                    <div>
                        <h1 class="text-sm font-display font-bold gradient-text leading-tight tracking-wider">ORACLE OF WIT</h1>
                        <p class="text-[9px] font-mono text-gray-600 tracking-widest flex items-center gap-1"><span class="text-oracle/60">${glLogo(10, 'rgb(45,212,191)')}</span>GENLAYER PROTOCOL</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5">
                    <div class="hidden sm:flex items-center gap-1.5 mr-2">
                        <div class="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                            ${glLogo(11, 'rgb(34,197,94)')}
                            <span class="text-[9px] font-mono text-green-400 tracking-wider">TESTNET</span>
                        </div>
                    </div>
                    <button data-action="toggleSound" class="btn btn-ghost p-1.5 rounded-lg text-sm">${soundEnabled ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'}</button>
                    ${state.profile ? `<span class="px-2 py-1 neon-border-wit rounded-lg text-xs font-mono" style="background:rgba(168,85,247,0.08)">Lv.${state.profile.level} <span class="text-wit">${esc(state.profile.title)}</span></span>` : state.playerName ? `<span class="px-2 py-1 neon-border-wit rounded-lg text-xs font-mono" style="background:rgba(168,85,247,0.08)">${esc(state.playerName)}</span>` : ''}
                    ${state.roomId ? `<span class="px-1.5 py-1 bg-obsidian border border-white/[0.06] rounded text-[10px] font-mono text-gray-400">${esc(state.roomId)}</span>` : ''}
                </div>
            </div>
        </header>
        ${state.room ? `
        <div class="consensus-hud border-b border-white/[0.03] py-1 px-2 sm:px-4" style="background:rgba(5,5,5,0.7);backdrop-filter:blur(12px)">
            <div class="w-full flex items-center justify-between text-gray-500 text-[10px] sm:text-xs font-mono">
                <div class="flex items-center gap-1 sm:gap-3">
                    <div class="flex items-center gap-1">${glLogo(12, 'rgb(34,197,94)')}<span class="hidden sm:inline">GenLayer</span></div>
                    <span class="text-white/10 hidden sm:inline">|</span>
                    <span>${state.room.players?.length || 0}P</span>
                    <span class="text-white/10">|</span>
                    <span>R${state.room.currentRound || 0}/${state.room.totalRounds || 5}</span>
                </div>
                <div class="flex items-center gap-1 sm:gap-3">
                    <span class="${state.room.status === 'judging' ? 'text-oracle' : ''}">${esc(state.room.status?.toUpperCase() || 'IDLE')}</span>
                    <span class="text-white/10">|</span>
                    <button data-action="confirmLeaveRoom" class="text-red-400/60 hover:text-red-400 transition-colors text-[10px] font-mono tracking-wider">EXIT</button>
                </div>
            </div>
        </div>
        ` : ''}
        ${state.room ? `
        <div class="w-full px-4 lg:px-6 py-5 pb-20 relative z-10 flex gap-6" style="max-width:1600px;margin:0 auto">
            ${renderLeftWing()}
            <main class="flex-1 min-w-0 screen-enter" style="max-width:900px">
                ${state.error ? `<div class="glow-card glow-card-red mb-4 p-3 text-red-300 text-sm font-mono animate-shake">\u26A0 ${esc(state.error)} <button data-action="dismissError" class="ml-3 text-red-400 hover:text-white">\u00D7</button></div>` : ''}
                ${renderScreen()}
            </main>
            ${renderRightWing()}
        </div>
        ` : `
        <main class="w-full relative z-10 screen-enter">
            ${state.error ? `<div class="mx-auto px-4 py-2" style="max-width:1400px"><div class="glow-card glow-card-red mb-4 p-3 text-red-300 text-sm font-mono animate-shake">\u26A0 ${esc(state.error)} <button data-action="dismissError" class="ml-3 text-red-400 hover:text-white">\u00D7</button></div></div>` : ''}
            ${renderScreen()}
        </main>
        `}
        </div>
    `;

    // Restore textarea focus and cursor position
    if (wasTextareaFocused) {
        const textarea = document.getElementById('punchline');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(selectionStart, selectionEnd);
        }
    }

    // Mount 3D oracle eyes after render
    requestAnimationFrame(() => {
        mountOracleEye('welcome-eye-3d', 160);
        mountOracleEye('header-eye', 32);
        oracleEye3D.setGameState(state.screen);
    });

    // Auto-dismiss errors after 5 seconds
    if (state.error) {
        clearTimeout(state._errorTimeout);
        state._errorTimeout = setTimeout(() => { state.error = null; render(); }, 5000);
    }
}
