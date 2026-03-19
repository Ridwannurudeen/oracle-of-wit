// Oracle of Wit — Render Functions
// Depends on: state.js, effects.js, api.js

// === HUD WING PANELS ===
function addGameEvent(type, text) {
    gameEvents.unshift({ type, text, time: Date.now() });
    if (gameEvents.length > 8) gameEvents.pop();
}

function renderLeftWingContent() {
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

function renderLeftWing() {
    return `
        <aside class="hidden lg:block hud-wing" style="width:250px;min-width:250px">
            <div data-hud="left-wing" class="glass-panel p-4 rounded-2xl">${renderLeftWingContent()}</div>
        </aside>
    `;
}

function renderRightWingContent() {
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
                            <span class="text-[10px] font-mono text-wit">${r.id || '—'}</span>
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
                            <span class="text-[10px] font-mono ${r.status === 'judging' ? 'text-oracle' : r.status === 'submitting' ? 'text-wit' : 'text-gray-400'}">${(r.status || 'IDLE').toUpperCase()}</span>
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

function renderRightWing() {
    return `
        <aside class="hidden lg:block hud-wing" style="width:250px;min-width:250px">
            <div data-hud="right-wing" class="glass-panel p-4 rounded-2xl">${renderRightWingContent()}</div>
        </aside>
    `;
}

function formatEventTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return 'earlier';
}

// === MAIN RENDER ===
function render(force = false) {
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
            renderPending = true;
            setTimeout(() => {
                renderPending = false;
                render();
            }, MIN_RENDER_INTERVAL);
        }
        return;
    }
    lastRenderTime = now;
    
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
                    <button onclick="toggleSound()" class="btn btn-ghost p-1.5 rounded-lg text-sm">${soundEnabled ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'}</button>
                    ${state.profile ? `<span class="px-2 py-1 neon-border-wit rounded-lg text-xs font-mono" style="background:rgba(168,85,247,0.08)">Lv.${state.profile.level} <span class="text-wit">${esc(state.profile.title)}</span></span>` : state.playerName ? `<span class="px-2 py-1 neon-border-wit rounded-lg text-xs font-mono" style="background:rgba(168,85,247,0.08)">${esc(state.playerName)}</span>` : ''}
                    ${state.roomId ? `<span class="px-1.5 py-1 bg-obsidian border border-white/[0.06] rounded text-[10px] font-mono text-gray-400">${state.roomId}</span>` : ''}
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
                    <span class="${state.room.status === 'judging' ? 'text-oracle' : ''}">${state.room.status?.toUpperCase() || 'IDLE'}</span>
                    <span class="text-white/10">|</span>
                    <button onclick="if(confirm('Leave this game?'))leaveRoom()" class="text-red-400/60 hover:text-red-400 transition-colors text-[10px] font-mono tracking-wider">EXIT</button>
                </div>
            </div>
        </div>
        ` : ''}
        ${state.room ? `
        <div class="w-full px-4 lg:px-6 py-5 pb-20 relative z-10 flex gap-6" style="max-width:1600px;margin:0 auto">
            ${renderLeftWing()}
            <main class="flex-1 min-w-0 screen-enter" style="max-width:900px">
                ${state.error ? `<div class="glow-card glow-card-red mb-4 p-3 text-red-300 text-sm font-mono animate-shake">⚠ ${esc(state.error)} <button onclick="state.error=null;render()" class="ml-3 text-red-400 hover:text-white">×</button></div>` : ''}
                ${renderScreen()}
            </main>
            ${renderRightWing()}
        </div>
        ` : `
        <main class="w-full relative z-10 screen-enter">
            ${state.error ? `<div class="mx-auto px-4 py-2" style="max-width:1400px"><div class="glow-card glow-card-red mb-4 p-3 text-red-300 text-sm font-mono animate-shake">⚠ ${esc(state.error)} <button onclick="state.error=null;render()" class="ml-3 text-red-400 hover:text-white">×</button></div></div>` : ''}
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

function renderTimer() {
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

function renderScreen() {
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

// === SCREEN RENDERERS ===
function renderWelcome() {
    return `
        <!-- HERO SECTION — full width -->
        <div class="text-center pt-16 pb-12 px-4">
            <div id="welcome-eye-3d" class="oracle-eye-3d mx-auto mb-10 animate-float oracle-eye rounded-full flex items-center justify-center processing" style="width:200px;height:200px"></div>
            <p class="font-mono text-sm text-oracle/60 tracking-[0.3em] mb-3">WELCOME TO</p>
            <h1 class="font-display font-bold mb-4 tracking-wider" style="font-size:clamp(2.5rem,6vw,4.5rem)"><span class="gradient-text">ORACLE OF WIT</span></h1>
            <p class="text-gray-400 text-base font-mono max-w-xl mx-auto mb-4">Decentralized humor arbitration protocol powered by GenLayer Intelligent Contracts</p>
            <div class="flex gap-3 flex-wrap justify-center mb-12">
                <div class="flex items-center gap-2 px-3 py-1.5 bg-oracle/10 border border-oracle/25 rounded-full">
                    <div class="w-2 h-2 rounded-full bg-oracle"></div>
                    <span class="text-[11px] font-mono text-oracle">Optimistic Democracy</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5 bg-oracle/10 border border-oracle/25 rounded-full">
                    <div class="w-2 h-2 rounded-full bg-green-500"></div>
                    <span class="text-[11px] font-mono text-gray-300">On-Chain Consensus</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5 bg-oracle/10 border border-oracle/25 rounded-full">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span class="text-[11px] font-mono text-gray-300">Verifiable Results</span>
                </div>
            </div>
        </div>

        <!-- HOW IT WORKS + LOGIN — contained width -->
        <div class="mx-auto px-4 pb-20" style="max-width:1100px">
            <!-- How It Works — 3 Column Data Cards -->
            <p class="text-consensus font-mono font-bold text-xs tracking-[0.2em] mb-5 text-center">HOW IT WORKS</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="data-card data-card-wit text-center py-8 px-6">
                    <div class="w-14 h-14 rounded-2xl bg-wit/15 border border-wit/25 flex items-center justify-center mx-auto mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </div>
                    <p class="font-display font-bold text-white text-lg mb-2 tracking-wider">WRITE</p>
                    <p class="text-gray-500 text-sm font-mono leading-relaxed">Complete the joke setup with your funniest punchline</p>
                    <div class="mt-4 pt-4 border-t border-white/[0.04]">
                        <span class="text-green-400 font-mono font-bold text-sm">+100 XP</span>
                        <span class="text-gray-600 font-mono text-[10px] block mt-1">WINNING JOKE</span>
                    </div>
                </div>
                <div class="data-card data-card-oracle text-center py-8 px-6">
                    <div class="w-14 h-14 rounded-2xl bg-oracle/15 border border-oracle/25 flex items-center justify-center mx-auto mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
                    </div>
                    <p class="font-display font-bold text-white text-lg mb-2 tracking-wider">BET</p>
                    <p class="text-gray-500 text-sm font-mono leading-relaxed">Stake XP on which punchline the Oracle will choose</p>
                    <div class="mt-4 pt-4 border-t border-white/[0.04]">
                        <span class="text-consensus font-mono font-bold text-sm">+BET x2</span>
                        <span class="text-gray-600 font-mono text-[10px] block mt-1">CORRECT PREDICTION</span>
                    </div>
                </div>
                <div class="data-card data-card-consensus text-center py-8 px-6">
                    <div class="w-14 h-14 rounded-2xl bg-consensus/15 border border-consensus/25 flex items-center justify-center mx-auto mb-4">
                        ${glLogo(28, '#FBBF24')}
                    </div>
                    <p class="font-display font-bold text-white text-lg mb-2 tracking-wider">JUDGE</p>
                    <p class="text-gray-500 text-sm font-mono leading-relaxed">AI validators reach on-chain consensus via GenLayer</p>
                    <div class="mt-4 pt-4 border-t border-white/[0.04]">
                        <span class="text-wit font-mono font-bold text-sm">5 VALIDATORS</span>
                        <span class="text-gray-600 font-mono text-[10px] block mt-1">OPTIMISTIC DEMOCRACY</span>
                    </div>
                </div>
            </div>

            <!-- GenLayer Protocol — Chip Cards -->
            <p class="text-oracle font-mono font-bold text-xs tracking-[0.2em] mb-4 text-center">POWERED BY GENLAYER</p>
            <div class="flex gap-3 flex-wrap justify-center mb-10">
                <div class="data-card data-card-oracle flex items-center gap-3 px-5 py-3" style="border-radius:12px;min-width:200px">
                    <div class="w-9 h-9 rounded-xl bg-oracle/15 border border-oracle/25 flex items-center justify-center shrink-0">
                        ${glLogo(20, '#2DD4BF')}
                    </div>
                    <div>
                        <p class="text-white text-xs font-display font-bold tracking-wider">INTELLIGENT CONTRACTS</p>
                        <p class="text-gray-500 text-[10px] font-mono">AI-native smart contracts</p>
                    </div>
                </div>
                <div class="data-card data-card-oracle flex items-center gap-3 px-5 py-3" style="border-radius:12px;min-width:200px">
                    <div class="w-9 h-9 rounded-xl bg-oracle/15 border border-oracle/25 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="1.5" stroke-linecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                    </div>
                    <div>
                        <p class="text-white text-xs font-display font-bold tracking-wider">OPTIMISTIC DEMOCRACY</p>
                        <p class="text-gray-500 text-[10px] font-mono">Multi-validator consensus</p>
                    </div>
                </div>
                <div class="data-card data-card-oracle flex items-center gap-3 px-5 py-3" style="border-radius:12px;min-width:200px">
                    <div class="w-9 h-9 rounded-xl bg-oracle/15 border border-oracle/25 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="1.5" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                    <div>
                        <p class="text-white text-xs font-display font-bold tracking-wider">VERIFIABLE RESULTS</p>
                        <p class="text-gray-500 text-[10px] font-mono">On-chain transparency</p>
                    </div>
                </div>
            </div>

            <!-- Login Card — centered, wide -->
            <div class="mx-auto" style="max-width:520px">
                <div class="glow-card p-8">
                    <label class="text-[10px] font-mono text-gray-500 tracking-[0.15em] block mb-3 text-left">PLAYER IDENTITY</label>
                    <input type="text" placeholder="Enter your name..." value="${esc(state.playerName)}"
                        oninput="state.playerName=this.value;if(typeof oracleEye3D!=='undefined')oracleEye3D.dilate()"
                        onblur="if(typeof oracleEye3D!=='undefined')oracleEye3D.undilate()"
                        onfocus="if(typeof oracleEye3D!=='undefined')oracleEye3D.dilate()"
                        onkeypress="if(event.key==='Enter')startBootSequence()"
                        class="w-full px-5 py-4 rounded-xl mb-5 text-base">
                    <div id="boot-container">
                        <button id="boot-btn" onclick="startBootSequence()" onmouseenter="playSound('hover')" class="btn btn-primary w-full py-4 rounded-xl text-sm text-white" style="box-shadow: 0 4px 30px rgba(168,85,247,0.3), inset 0 1px 0 rgba(255,255,255,0.1);font-size:0.9rem">
                            INITIALIZE SESSION
                        </button>
                    </div>
                </div>
                <div class="mt-4 text-center">
                    <a href="https://www.genlayer.com" target="_blank" class="inline-flex items-center gap-1.5 text-[10px] font-mono text-oracle/40 hover:text-oracle transition-colors tracking-wider"><span class="opacity-60">${glLogo(14, 'rgb(45,212,191)')}</span>POWERED BY GENLAYER &rarr;</a>
                </div>
            </div>
        </div>
    `;
}

function renderProfileCard() {
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
                <button onclick="state.screen='profile';render()" class="btn btn-ghost text-xs px-3 py-1.5 rounded-lg">PROFILE</button>
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
                return a ? `<span title="${a.name}" class="text-lg">${a.icon}</span>` : '';
            }).join('')}${p.achievements.length > 8 ? `<span class="text-xs text-gray-500">+${p.achievements.length-8}</span>` : ''}</div>` : ''}
        </div>`;
}

function renderLobby() {
    const gamesPlayedToday = parseInt(localStorage.getItem('gamesToday_' + getTodayKeyClient()) || '0');
    return `
        <div class="mx-auto px-4 lg:px-8 py-8 pb-20" style="max-width:1200px">
            <!-- Lobby Header -->
            <div class="text-center mb-8">
                <h2 class="text-3xl md:text-4xl font-display font-bold mb-2 tracking-wider"><span class="gradient-text">GAME LOBBY</span></h2>
                ${gamesPlayedToday > 0 ? `<p class="text-[10px] font-mono text-gray-600 tracking-wider">SESSIONS TODAY: ${gamesPlayedToday}</p>` : ''}
            </div>

            <!-- Row 1: Profile + Weekly Theme -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>${renderProfileCard()}</div>
                ${state.currentWeeklyTheme ? `
                <div class="glow-card glow-card-amber p-5 flex items-center">
                    <div class="flex items-center gap-4 w-full">
                        <span class="text-4xl">${state.currentWeeklyTheme.emoji}</span>
                        <div class="flex-1">
                            <p class="text-[10px] font-mono text-wit tracking-widest mb-1">THIS WEEK'S THEME</p>
                            <p class="font-display font-bold text-xl tracking-wider">${state.currentWeeklyTheme.name}</p>
                            <p class="text-sm text-gray-400 mt-1">${state.currentWeeklyTheme.description}</p>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="glow-card p-5 flex flex-col justify-center items-center text-center" style="border:1px dashed rgba(168,85,247,0.2)">
                    <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">NO WEEKLY THEME</p>
                    <p class="text-xs text-gray-500">Check back soon for themed rounds</p>
                </div>
                `}
            </div>

            <!-- Row 2: Solo Mode + Multiplayer side by side -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <!-- Solo Mode -->
                <div class="glow-card glow-card-gold p-6">
                    <div class="flex items-center gap-2 mb-2">
                        <h3 class="text-xl font-display font-bold tracking-wider">SOLO MODE</h3>
                        <span class="text-[9px] font-mono text-consensus/60 bg-consensus/10 px-2 py-0.5 rounded border border-consensus/20">VS AI</span>
                    </div>
                    <p class="text-gray-500 text-xs font-mono mb-5">Practice against oracle-calibrated bots</p>
                    <div class="grid grid-cols-3 gap-3">
                        <button onclick="createRoom('tech',true)" class="btn cat-btn p-4 bg-gradient-to-br from-blue-900/80 to-cyan-900/80 rounded-xl text-white border border-cyan-500/30 hover:border-cyan-400/50 transition-all hover:scale-[1.03]">
                            <span class="text-2xl block mb-1.5">🤖</span><span class="text-[10px] font-mono tracking-wider font-bold">TECH</span>
                        </button>
                        <button onclick="createRoom('crypto',true)" class="btn cat-btn p-4 bg-gradient-to-br from-amber-900/80 to-orange-900/80 rounded-xl text-white border border-amber-500/30 hover:border-amber-400/50 transition-all hover:scale-[1.03]">
                            <span class="text-2xl block mb-1.5">💎</span><span class="text-[10px] font-mono tracking-wider font-bold">CRYPTO</span>
                        </button>
                        <button onclick="createRoom('general',true)" class="btn cat-btn p-4 bg-gradient-to-br from-purple-900/80 to-pink-900/80 rounded-xl text-white border border-purple-500/30 hover:border-purple-400/50 transition-all hover:scale-[1.03]">
                            <span class="text-2xl block mb-1.5">😂</span><span class="text-[10px] font-mono tracking-wider font-bold">GENERAL</span>
                        </button>
                    </div>
                </div>

                <!-- Multiplayer -->
                <div class="glow-card p-6">
                    <div class="flex items-center gap-2 mb-2">
                        <h3 class="text-xl font-display font-bold tracking-wider">MULTIPLAYER</h3>
                        <span class="text-[9px] font-mono text-wit/60 bg-wit/10 px-2 py-0.5 rounded border border-wit/20">2-100</span>
                    </div>
                    <p class="text-gray-500 text-xs font-mono mb-5">Create a room and invite players</p>
                    <div class="grid grid-cols-3 gap-3 mb-4">
                        <button onclick="createRoom('tech',false)" class="btn cat-btn p-4 bg-obsidian rounded-xl text-white border border-white/[0.06] hover:border-wit/30 transition-all hover:scale-[1.03]">
                            <span class="text-2xl block mb-1.5">🤖</span><span class="text-[10px] font-mono text-gray-400 font-bold">TECH</span>
                        </button>
                        <button onclick="createRoom('crypto',false)" class="btn cat-btn p-4 bg-obsidian rounded-xl text-white border border-white/[0.06] hover:border-wit/30 transition-all hover:scale-[1.03]">
                            <span class="text-2xl block mb-1.5">💎</span><span class="text-[10px] font-mono text-gray-400 font-bold">CRYPTO</span>
                        </button>
                        <button onclick="createRoom('general',false)" class="btn cat-btn p-4 bg-obsidian rounded-xl text-white border border-white/[0.06] hover:border-wit/30 transition-all hover:scale-[1.03]">
                            <span class="text-2xl block mb-1.5">😂</span><span class="text-[10px] font-mono text-gray-400 font-bold">GENERAL</span>
                        </button>
                    </div>

                    <div class="flex gap-2">
                        <input type="text" id="room-code" placeholder="Enter room code..."
                            onkeypress="if(event.key==='Enter')joinRoom(this.value)"
                            class="flex-1 px-4 py-2.5 rounded-xl uppercase">
                        <button onclick="joinRoom(document.getElementById('room-code').value)" class="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-white">Join</button>
                    </div>

                    ${state.publicRooms.length > 0 ? `
                        <div class="mt-4 space-y-2">
                            <p class="text-[10px] font-mono text-gray-600 tracking-widest">OPEN ROOMS</p>
                            ${state.publicRooms.map(r => `
                                <div class="flex justify-between items-center p-2.5 bg-obsidian border border-white/[0.04] rounded-xl">
                                    <div>
                                        <span class="font-mono text-wit">${r.id}</span>
                                        ${r.status !== 'waiting' ? `<span class="text-xs ml-1 ${r.status === 'finished' ? 'text-gray-500' : 'text-green-400'}">R${r.currentRound}/${r.totalRounds}</span>` : ''}
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs text-gray-400">${r.players}p${r.spectators ? ' '+r.spectators+'s' : ''}</span>
                                        ${r.status === 'waiting' ? `
                                            <button onclick="joinRoom('${r.id}')" class="btn btn-primary px-3 py-1 rounded-lg text-sm text-white">Join</button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Row 3: Daily Challenge + Community Prompts side by side -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div class="glow-card glow-card-amber p-5">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <h3 class="text-lg font-display font-bold tracking-wider">DAILY ORACLE</h3>
                            <p class="text-gray-500 text-xs font-mono">One prompt. One shot. Global leaderboard.</p>
                        </div>
                        ${state.profile?.dailyChallengeStreak > 0 ? `<span class="text-consensus font-mono text-sm font-bold">${'🔥'.repeat(Math.min(state.profile.dailyChallengeStreak, 5))} ${state.profile.dailyChallengeStreak}d</span>` : ''}
                    </div>
                    <button onclick="fetchDailyChallenge()" onmouseenter="playSound('hover')" class="btn btn-play w-full py-3 rounded-xl text-sm">
                        ENTER DAILY CHALLENGE
                    </button>
                </div>

                <div class="glow-card glow-card-cyan p-5 flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <p class="font-mono text-oracle text-[10px] tracking-wider font-bold mb-0.5">COMMUNITY PROMPTS</p>
                            <p class="text-gray-500 text-xs font-mono">Submit joke setups — top-voted enter rotation</p>
                        </div>
                    </div>
                    <button onclick="fetchCommunityPrompts()" onmouseenter="playSound('hover')" class="btn btn-teal w-full py-3 rounded-xl text-sm text-white">SUBMIT PROMPT</button>
                </div>
            </div>

            <!-- Challenge link notification -->
            ${state.challengeData ? `
                <div class="glow-card glow-card-cyan p-4 mb-5">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-oracle font-display font-bold text-sm tracking-wider mb-1">FRIEND CHALLENGE</p>
                            <p class="text-xs font-mono text-gray-400">${esc(state.challengeData.creatorName)} scored ${state.challengeData.creatorScore} XP — can you beat them?</p>
                        </div>
                        <button onclick="createRoom('${state.challengeData.category}', true)" class="btn btn-teal px-5 py-2.5 rounded-xl text-xs text-white font-bold">ACCEPT</button>
                    </div>
                </div>
            ` : ''}

            <!-- Leaderboard / Hall of Fame -->
            <div class="flex gap-1 mb-0">
                <button onclick="playSound('tab');state.showHallOfFame=false;render()" class="btn flex-1 py-2.5 ${!state.showHallOfFame ? 'tab-active' : 'tab-inactive'} rounded-t-xl text-[10px] font-mono tracking-wider">LEADERBOARD</button>
                <button onclick="playSound('tab');fetchHallOfFame()" class="btn flex-1 py-2.5 ${state.showHallOfFame ? 'tab-active' : 'tab-inactive'} rounded-t-xl text-[10px] font-mono tracking-wider">HALL OF FAME</button>
            </div>

            ${state.showHallOfFame ? `
                <div class="glow-card-gold glow-card rounded-t-none p-5" style="border-top-left-radius:0;border-top-right-radius:0">
                    ${state.hallOfFame.length > 0 ? `
                        <div class="space-y-3 max-h-96 overflow-y-auto">
                            ${state.hallOfFame.slice(0, 20).map(j => `
                                <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3">
                                    <p class="text-sm text-gray-400 mb-1">"${esc(j.prompt)}"</p>
                                    <p class="text-white font-medium">"${esc(j.punchline)}"</p>
                                    <div class="flex justify-between items-center mt-1">
                                        <span class="text-xs text-consensus">by ${esc(j.author)}</span>
                                        ${j.commentary ? `<span class="text-xs text-gray-500 italic">${esc(j.commentary)}</span>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-gray-500 text-center py-4">No jokes yet. Be the first!</p>'}
                </div>
            ` : ''}

            ${!state.showHallOfFame && state.leaderboard.length > 0 ? `
                <div class="glow-card rounded-t-none p-5" style="border-top-left-radius:0;border-top-right-radius:0">
                    <div class="space-y-2">
                        ${state.leaderboard.slice(0,10).map((p,i) => `
                            <div class="flex justify-between items-center p-2.5 ${i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
                                    <span class="truncate max-w-[140px]">${esc(p.name)}</span>
                                </div>
                                <span class="text-consensus font-mono font-bold shrink-0">${p.totalScore} XP</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : !state.showHallOfFame ? '' : ''}
        </div>
    `;
}

function getTodayKeyClient() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function renderWaiting() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    return `
        <div class="glow-card p-6">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h2 class="text-xl font-display font-bold tracking-wider">${r.isSinglePlayer ? 'SOLO MODE' : r.id}</h2>
                    <span class="text-[10px] font-mono ${r.isSinglePlayer ? 'text-consensus/60' : 'text-oracle/60'} tracking-widest">${r.isSinglePlayer ? 'VS ORACLE BOTS' : 'AWAITING PLAYERS'}</span>
                </div>
                <button onclick="leaveRoom()" class="btn btn-ghost px-3 py-2 rounded-lg text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            ${!r.isSinglePlayer ? `
                <div class="mb-4 p-4 bg-obsidian rounded-xl text-center border border-white/[0.04]">
                    <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">ROOM CODE</p>
                    <div class="flex items-center justify-center gap-2">
                        <p class="font-mono text-2xl text-wit select-all tracking-wider">${r.id}</p>
                        <button onclick="copyRoomCode('${r.id}')" class="btn btn-ghost p-2 rounded-lg text-gray-400" title="Copy code">
                            <span class="text-sm">COPY</span>
                        </button>
                    </div>
                    <p id="copy-feedback" class="text-oracle text-xs font-mono mt-1 hidden">Copied to clipboard</p>
                </div>
            ` : ''}

            <div class="mb-4">
                <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">CONNECTED &middot; ${r.players.length}</p>
                <div class="grid grid-cols-2 gap-2">
                    ${r.players.map(p => `
                        <div class="flex items-center gap-2 p-2.5 bg-obsidian rounded-xl border ${p.name===state.playerName?'border-wit/30':'border-white/[0.04]'}">
                            <div class="w-6 h-6 rounded-full ${p.isHost?'bg-consensus/20':p.isBot?'bg-oracle/20':'bg-wit/20'} flex items-center justify-center">
                                <span class="text-xs">${p.isHost?'H':p.isBot?'B':'P'}</span>
                            </div>
                            <span class="truncate text-sm">${esc(p.name)}</span>
                            ${p.isBot?'<span class="text-[9px] font-mono text-oracle/60 bg-oracle/10 px-1 py-0.5 rounded">BOT</span>':''}
                            ${p.name===state.playerName?'<span class="text-[9px] font-mono text-wit/80 bg-wit/10 px-1 py-0.5 rounded">YOU</span>':''}
                        </div>
                    `).join('')}
                </div>
            </div>

            ${state.isHost ? `
                <button onclick="startGame()" onmouseenter="playSound('hover')" ${!r.isSinglePlayer && r.players.length<2 || state.loading ? 'disabled' : ''}
                    class="btn btn-play w-full py-4 rounded-xl font-bold text-sm">
                    ${state.loading ? '<span class="spinner inline-block w-5 h-5 mr-2 align-middle"></span>INITIALIZING...' : !r.isSinglePlayer && r.players.length<2 ? 'NEED 2+ PLAYERS' : 'INITIALIZE GAME'}
                </button>
            ` : '<div class="text-center py-4 text-gray-500 font-mono text-xs tracking-wider"><div class="spinner mx-auto mb-2"></div>WAITING FOR HOST</div>'}
        </div>
    `;
}

function renderSubmitting() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const submitted = r.submissions?.filter(s => !r.players.find(p => p.name === s.playerName)?.isBot).length || 0;
    const humanPlayers = r.players.filter(p => !p.isBot).length;

    return `
        <div class="space-y-4">
            ${renderTimer()}
            <div class="glow-card p-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-wit text-xs font-bold tracking-wider">ROUND ${r.currentRound}/${r.totalRounds}</span>
                    ${r.weeklyTheme ? `<span class="text-[9px] font-mono text-consensus/60 bg-consensus/10 px-1.5 py-0.5 rounded border border-consensus/20">${r.weeklyTheme.emoji} ${r.weeklyTheme.name}</span>` : ''}
                </div>
                <span data-hud="submitted" class="text-[10px] font-mono text-gray-500 tracking-wider">${submitted}/${humanPlayers} SUBMITTED</span>
            </div>
            <div class="glow-card p-5" style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(45,212,191,0.04),rgba(10,10,18,0.95))">
                <p class="text-[10px] font-mono text-oracle/60 tracking-widest mb-2">COMPLETE THIS JOKE</p>
                <p class="text-xl font-display font-medium">"${esc(r.jokePrompt)}"</p>
                ${r.promptSource?.type === 'community' ? `<p class="text-[10px] font-mono text-oracle mt-2 tracking-wider">COMMUNITY PROMPT by ${esc(r.promptSource.author)}</p>` : ''}
            </div>
            ${!state.hasSubmitted ? `
                <div class="glow-card p-4">
                    <textarea id="punchline" maxlength="200" placeholder="Write your funniest punchline..."
                        oninput="state.punchlineText=this.value;setTyping();updateCharCount()"
                        onfocus="setTyping()"
                        onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitPunchline()}else{setTyping()}"
                        onkeyup="setTyping()"
                        class="w-full h-28 px-4 py-3 rounded-xl text-lg resize-none">${state.punchlineText}</textarea>
                    <p class="text-[9px] font-mono text-gray-600/50 mt-1 tracking-wider">CTRL+ENTER TO SUBMIT</p>
                    <div class="flex justify-between items-center mt-3">
                        <span id="char-count" class="text-[10px] font-mono text-gray-600 tracking-wider">${state.punchlineText.length}/200</span>
                        <button onclick="submitPunchline()" onmouseenter="playSound('hover')" class="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-white text-xs">SUBMIT</button>
                    </div>
                </div>
            ` : `
                <div class="glow-card glow-card-green p-6 text-center">
                    <div class="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                        <span class="text-green-400 font-mono text-2xl">OK</span>
                    </div>
                    <p class="text-green-400 font-display font-bold text-lg tracking-wider">SUBMITTED</p>
                    <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">AWAITING TIMER EXPIRY</p>
                </div>
            `}
            ${state.isHost && r.submissions.length >= 1 ? `
                <button onclick="advancePhase()" class="btn btn-ghost w-full py-2 rounded-xl text-xs">SKIP TO BETTING</button>
            ` : ''}
        </div>
    `;
}


function renderRevealing() {
    if (!state.room) return '';
    const r = state.room;
    const result = r.roundResults[r.roundResults.length - 1];
    if (!result) return '';

    const revealOrder = result.revealOrder || r.submissions.map(s => s.id);
    const totalJokes = revealOrder.length;
    const revealed = state.revealedJokes;
    const current = revealed[revealed.length - 1];
    const isShowingWinner = current?.isWinner;
    const commentary = result.aiCommentary;

    // Crowd reaction meter levels
    const meterLevels = ['Crickets', 'Chuckle', 'Laugh', 'ROFL'];
    const meterIndex = Math.min(revealed.length, meterLevels.length - 1);
    const meterPct = ((revealed.length) / totalJokes) * 100;

    // Aggregate reactions for current joke
    const reactions = r.reactions || [];
    const currentReactions = current ? reactions.filter(rx => rx.submissionId === current.id) : [];
    const emojiCounts = {};
    currentReactions.forEach(rx => { emojiCounts[rx.emoji] = (emojiCounts[rx.emoji] || 0) + 1; });

    return `
        <div class="space-y-4">
            <div class="glow-card p-3 flex justify-between items-center">
                <span class="font-mono text-wit text-xs font-bold tracking-wider">ROUND ${result.round} — REVEAL</span>
                <span class="text-[10px] font-mono text-gray-500 tracking-wider">${revealed.length}/${totalJokes} REVIEWED</span>
            </div>

            <div class="glow-card p-3 text-center">
                <p class="text-gray-400 text-sm">"${esc(r.jokePrompt)}"</p>
            </div>

            ${revealed.length === 0 ? `
                <div class="glow-card p-8 text-center animate-glow" style="border-radius:20px">
                    <div class="w-20 h-20 oracle-eye rounded-full flex items-center justify-center mx-auto mb-4 animate-float processing">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" style="filter:brightness(1.5)"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" fill="#A855F7" stroke="none"/></svg>
                    </div>
                    <p class="text-xl font-display font-bold gradient-text tracking-wider">ORACLE REVIEWING</p>
                    <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">PREPARING JUDGMENT</p>
                </div>
            ` : ''}

            ${current && !isShowingWinner ? `
                <div class="glow-card glow-card-red p-6 animate-slideIn">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-red-400 font-mono text-xs font-bold tracking-wider">ELIMINATED</span>
                        <span class="text-gray-600 text-[10px] font-mono">#${current.id}</span>
                    </div>
                    <p class="text-lg">"${esc(current.punchline)}"</p>
                    <p class="text-gray-500 text-xs font-mono mt-1">${esc(current.playerName)}</p>
                    ${commentary?.roasts?.[current.id] ? `
                        <p class="text-gray-400 text-sm mt-2 italic typewriter">${esc(commentary.roasts[current.id])}</p>
                    ` : ''}
                    ${Object.keys(emojiCounts).length > 0 ? `
                        <div class="flex gap-2 mt-2">${Object.entries(emojiCounts).map(([e,c]) => `<span class="text-xs bg-obsidian px-2 py-1 rounded-full border border-white/[0.04]">${e} x${c}</span>`).join('')}</div>
                    ` : ''}
                </div>
            ` : ''}

            ${isShowingWinner ? `
                <div class="glow-card glow-card-gold p-8 text-center animate-winnerScale animate-goldPulse">
                    <p class="text-[10px] font-mono text-consensus/60 tracking-[0.3em] mb-2">WINNER</p>
                    <p class="text-consensus font-display font-bold text-xl mb-2 tracking-wider">THE ORACLE HAS SPOKEN</p>
                    <p class="text-2xl font-display font-bold my-3">"${esc(current.punchline)}"</p>
                    <p class="text-gray-400 text-sm font-mono">${esc(current.playerName)}</p>
                    ${commentary?.winnerComment ? `
                        <p class="text-consensus/80 text-sm mt-3 italic">${esc(commentary.winnerComment)}</p>
                    ` : ''}
                    ${result.streak >= 2 ? `
                        <div class="mt-3 streak-fire text-sm font-mono font-bold text-orange-400 tracking-wider">${'🔥'.repeat(Math.min(result.streak, 5))} ${result.streak}-WIN STREAK</div>
                    ` : ''}
                    ${result.isComeback ? `
                        <div class="mt-2 animate-comeback text-sm font-mono font-bold text-oracle tracking-wider">COMEBACK</div>
                    ` : ''}
                </div>
            ` : ''}

            ${revealed.length > 0 ? `
                <div class="glow-card p-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-mono text-gray-600 tracking-widest">CROWD REACTION</span>
                        <span class="text-xs font-mono font-bold ${meterIndex >= 2 ? 'text-green-400' : 'text-gray-500'}">${meterLevels[meterIndex]}</span>
                    </div>
                    <div class="h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                        <div class="h-full rounded-full bg-gradient-to-r from-consensus to-red-500 meter-fill" style="--fill-pct: ${meterPct}%"></div>
                    </div>
                </div>
            ` : ''}

            ${revealed.filter(j => j.eliminated && j !== current).length > 0 ? `
                <div class="space-y-1">
                    ${revealed.filter(j => j.eliminated && j !== current).map(j => `
                        <div class="bg-obsidian/50 rounded-xl p-2 opacity-40 border border-white/[0.02]">
                            <div class="flex items-center gap-2">
                                <span class="text-red-400 text-[10px] font-mono">X</span>
                                <span class="text-[10px] font-mono text-gray-600 truncate">"${esc(j.punchline)}" — ${esc(j.playerName)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <button onclick="skipReveal()" class="btn btn-ghost w-full py-2 rounded-xl text-xs text-gray-500">
                SKIP REVEAL
            </button>
        </div>
    `;
}

function renderCurating() {
    const r = state.room;
    if (!r) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const total = r.submissions?.length || 0;

    return `
        <div class="space-y-6">
            <div class="glow-card p-6 text-center" style="border-radius:20px">
                <div class="w-20 h-20 oracle-eye rounded-full flex items-center justify-center mx-auto mb-4 animate-glow processing">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" style="filter:brightness(1.5)"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" fill="#A855F7" stroke="none"/></svg>
                </div>
                <p class="text-[10px] font-mono text-oracle/60 tracking-[0.3em] mb-2">PROCESSING</p>
                <h2 class="text-2xl font-display font-bold mb-2 tracking-wider">ORACLE CURATING</h2>
                <p class="text-wit text-xs font-mono mb-4 tracking-wider">${total} SUBMISSIONS — SELECTING TOP 8</p>
                <div class="glass-bright rounded-xl p-4">
                    <div class="flex items-center justify-center gap-3">
                        <div class="spinner"></div>
                        <span class="text-gray-400 text-xs font-mono tracking-wider">ANALYZING HUMOR, ORIGINALITY, TIMING</span>
                    </div>
                    <div class="mt-3 h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                        <div class="h-full bg-gradient-to-r from-wit to-oracle rounded-full animate-pulse" style="width:75%"></div>
                    </div>
                </div>
                <p class="text-[10px] font-mono text-gray-600 mt-3 tracking-wider">LARGE ROOM — AUDIENCE VOTES ON FINALISTS</p>
            </div>
        </div>
    `;
}

function renderVoting() {
    const r = state.room;
    if (!r) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';

    const curatedIds = r.curatedIds || [];
    const curated = r.submissions?.filter(s => curatedIds.includes(s.id)) || [];
    const totalVotes = Object.keys(r.audienceVotes || {}).length;
    const humanPlayers = r.players?.filter(p => !p.isBot).length || 1;
    const hasVoted = !!(r.audienceVotes?.[state.playerName]);

    return `
        <div class="space-y-4">
            ${renderTimer()}
            <div class="glow-card p-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-oracle text-xs font-bold tracking-wider">ROUND ${r.currentRound} — VOTE</span>
                    <span class="text-[9px] font-mono text-oracle/60 bg-oracle/10 px-1.5 py-0.5 rounded border border-oracle/20">TOP ${curated.length}</span>
                </div>
                <span class="text-[10px] font-mono text-gray-500 tracking-wider">${totalVotes}/${humanPlayers} VOTED</span>
            </div>
            <div class="glow-card p-2.5">
                <p class="text-sm text-gray-400 truncate">"${esc(r.jokePrompt)}"</p>
                ${r.promptSource?.type === 'community' ? `<p class="text-[10px] font-mono text-oracle mt-1 tracking-wider">COMMUNITY PROMPT by ${esc(r.promptSource.author)}</p>` : ''}
            </div>
            <p class="text-center text-sm font-display font-bold tracking-wider">VOTE FOR THE FUNNIEST</p>
            <div class="space-y-3">
                ${curated.map(s => `
                    <div onclick="${hasVoted ? '' : `castVote(${s.id})`}" class="glow-card p-4 ${hasVoted ? 'opacity-70' : 'cursor-pointer hover:bg-white/[0.03]'} ${state.votedFor === s.id ? 'card-selected' : ''}">
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm ${state.votedFor === s.id ? 'bg-oracle text-void' : 'bg-obsidian border border-white/[0.06]'}">${s.id}</div>
                            <p class="flex-1 text-sm">${esc(s.punchline)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${hasVoted ? `
                <div class="glow-card glow-card-green p-6 text-center">
                    <div class="w-14 h-14 rounded-full bg-oracle/10 border border-oracle/30 flex items-center justify-center mx-auto mb-2">
                        <span class="text-oracle font-mono text-xl">OK</span>
                    </div>
                    <p class="text-oracle font-display font-bold text-lg tracking-wider">VOTE CAST</p>
                    <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">AWAITING OTHER PLAYERS</p>
                </div>
            ` : `
                <p class="text-center text-[10px] font-mono text-gray-600 tracking-wider">TAP A PUNCHLINE TO VOTE — CANNOT VOTE FOR YOUR OWN</p>
            `}
            ${state.isHost ? `
                <button onclick="advancePhase()" class="btn btn-ghost w-full py-2 rounded-xl text-xs">SKIP TO RESULTS</button>
            ` : ''}
        </div>
    `;
}

function renderBetting() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const humanBets = r.bets?.filter(b => !r.players.find(p => p.name === b.playerName)?.isBot).length || 0;
    const humanPlayers = r.players.filter(p => !p.isBot).length;

    return `
        <div class="space-y-4">
            ${renderTimer()}
            <div class="glow-card p-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-consensus text-xs font-bold tracking-wider">ROUND ${r.currentRound} — BETTING</span>
                    ${r.weeklyTheme ? `<span class="text-[9px] font-mono text-consensus/60 bg-consensus/10 px-1.5 py-0.5 rounded border border-consensus/20">${r.weeklyTheme.emoji} ${r.weeklyTheme.name}</span>` : ''}
                </div>
                <span data-hud="bets" class="text-[10px] font-mono text-gray-500 tracking-wider">${humanBets}/${humanPlayers} BET</span>
            </div>
            <div class="glow-card p-2.5">
                <p class="text-sm text-gray-400 truncate">"${esc(r.jokePrompt)}"</p>
                ${r.promptSource?.type === 'community' ? `<p class="text-[10px] font-mono text-oracle mt-1 tracking-wider">COMMUNITY PROMPT by ${esc(r.promptSource.author)}</p>` : ''}
            </div>
            <p class="text-center text-sm font-display font-bold tracking-wider">PREDICT THE ORACLE'S PICK</p>
            <p class="text-center text-[10px] font-mono text-red-400/80 tracking-wider">WRONG PREDICTIONS COST YOUR BET</p>
            <div class="space-y-3">
                ${r.submissions.map(s => {
                    const rxForThis = (r.reactions||[]).filter(rx => rx.submissionId === s.id);
                    const emojiCounts = {};
                    rxForThis.forEach(rx => { emojiCounts[rx.emoji] = (emojiCounts[rx.emoji]||0) + 1; });
                    return `
                    <div class="relative">
                        <div onclick="selectSubmission(${s.id})" class="glow-card p-4 cursor-pointer hover:bg-white/[0.03] ${state.selectedSubmission===s.id?'card-selected':''}">
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm ${state.selectedSubmission===s.id?'bg-wit text-void':'bg-obsidian border border-white/[0.06]'}">${s.id}</div>
                                <p class="flex-1 text-sm">${esc(s.punchline)}</p>
                            </div>
                            ${Object.keys(emojiCounts).length > 0 ? `
                                <div class="flex gap-1 mt-2 ml-12">${Object.entries(emojiCounts).map(([e,c]) => `<span class="text-xs bg-obsidian px-1.5 py-0.5 rounded-full border border-white/[0.04]">${e}${c>1?' x'+c:''}</span>`).join('')}</div>
                            ` : ''}
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1 justify-end">
                            ${['😂','🔥','💀','😐','👏','🤮'].map(e => `
                                <button onclick="event.stopPropagation();sendReaction(${s.id},'${e}')" class="text-base sm:text-lg hover:scale-125 transition-transform ${state.sentReactions >= 3 ? 'opacity-30 pointer-events-none' : ''}" title="React">${e}</button>
                            `).join('')}
                        </div>
                    </div>
                `}).join('')}
            </div>
            ${(() => {
                const budget = r.betBudgets?.[state.playerName] ?? 300;
                const sliderMax = Math.min(100, budget);
                if (state.betAmount > sliderMax) state.betAmount = sliderMax;
                if (state.hasBet) return `
                    <div class="glow-card glow-card-green p-6 text-center">
                        <div class="w-14 h-14 rounded-full bg-consensus/10 border border-consensus/30 flex items-center justify-center mx-auto mb-3">
                            <span class="text-consensus font-mono text-xl">OK</span>
                        </div>
                        <p class="text-consensus font-display font-bold text-lg tracking-wider">BET PLACED</p>
                        <p class="text-gray-500 mt-2 text-xs font-mono tracking-wider">BUDGET: <span class="text-consensus font-bold">${budget} XP</span></p>
                    </div>`;
                if (budget <= 0) return `
                    <div class="glow-card p-6 text-center">
                        <p class="text-gray-500 font-display font-bold tracking-wider">NO BETS REMAINING</p>
                        <p class="text-[10px] font-mono text-gray-600 mt-1 tracking-wider">BUDGET DEPLETED — OBSERVING</p>
                    </div>`;
                return `
                    <div class="glow-card p-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] font-mono text-gray-600 tracking-widest">GAME BUDGET</span>
                            <span class="text-sm font-mono font-bold ${budget <= 50 ? 'text-red-400' : 'text-consensus'}">${budget} XP</span>
                        </div>
                        <div class="flex items-center gap-3 mb-3">
                            <span class="text-[10px] font-mono text-gray-500 tracking-wider">BET</span>
                            <input type="range" min="10" max="${sliderMax}" step="10" value="${state.betAmount}" oninput="state.betAmount=+this.value;updateBetDisplay()" class="flex-1">
                            <span id="bet-amount-display" class="text-xl font-mono font-bold text-consensus">${state.betAmount}</span>
                        </div>
                        <button id="bet-submit-btn" onclick="placeBet()" ${!state.selectedSubmission?'disabled':''} class="btn btn-play w-full py-3 rounded-xl font-bold text-sm">BET ON #${state.selectedSubmission||'?'}</button>
                    </div>`;
            })()}
            ${state.isHost && r.bets.length >= 1 ? `
                <button onclick="advancePhase()" class="btn btn-ghost w-full py-2 rounded-xl text-xs">SKIP TO JUDGING</button>
            ` : ''}
        </div>
    `;
}

function renderJudging() {
    // Start the validator voting animation if not already started
    if (!state.validatorVotingStarted) {
        state.validatorVotingStarted = true;
        state.validatorVotes = [];
        state.consensusReached = false;
        startValidatorVoting();
    }

    const validators = [
        { name: 'GPT-4', icon: '🤖', color: 'bg-green-500', taste: 'Loves clever wordplay', thoughts: ['Analyzing wordplay...', 'Checking pun quality...', 'Rating timing...'] },
        { name: 'Claude', icon: '🧠', color: 'bg-purple-500', taste: 'Appreciates dark irony', thoughts: ['Evaluating irony...', 'Detecting layers...', 'Judging subtlety...'] },
        { name: 'LLaMA', icon: '🦙', color: 'bg-blue-500', taste: 'Enjoys absurdist humor', thoughts: ['How absurd is this?', 'Rating chaos...', 'Measuring weird...'] },
        { name: 'Gemini', icon: '💫', color: 'bg-yellow-500', taste: 'Values surprise twists', thoughts: ['Checking twists...', 'Rating shock value...', 'Surprise factor...'] },
        { name: 'Mixtral', icon: '🔮', color: 'bg-pink-500', taste: 'Loves cultural references', thoughts: ['Scanning refs...', 'Rating cultural IQ...', 'Checking depth...'] }
    ];

    const votedCount = state.validatorVotes?.length || 0;
    const consensusReached = state.consensusReached || false;

    // Build vote distribution for bar chart
    const voteDist = {};
    (state.validatorVotes || []).forEach(v => { voteDist[v] = (voteDist[v] || 0) + 1; });
    const maxVotes = Math.max(...Object.values(voteDist), 1);
    const submissions = state.room?.submissions || [];

    return `
        <div class="glow-card p-6 text-center" style="border-radius:20px">
            <div class="w-24 h-24 oracle-eye rounded-full flex items-center justify-center mx-auto mb-4 ${consensusReached ? '' : 'animate-glow processing'}">
                <span class="text-4xl" style="filter:brightness(1.5)">${consensusReached ? '✨' : ''}</span>${!consensusReached ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A855F7" stroke-width="1.5" style="filter:brightness(1.5)"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" fill="#A855F7" stroke="none"/></svg>' : ''}
            </div>
            <p class="text-[10px] font-mono text-oracle/60 tracking-[0.3em] mb-1">${consensusReached ? 'FINALIZED' : 'PROCESSING'}</p>
            <h2 class="text-2xl font-display font-bold mb-2 tracking-wider">${consensusReached ? 'CONSENSUS REACHED' : 'ORACLE JUDGING'}</h2>
            <p class="text-wit text-xs font-mono mb-1 tracking-wider flex items-center justify-center gap-1.5">${glLogo(14, 'rgb(168,85,247)')} GENLAYER OPTIMISTIC DEMOCRACY</p>
            <p class="text-[10px] font-mono text-gray-600 mb-4 tracking-wider">INDEPENDENT VALIDATORS EVALUATE — CONSENSUS ON-CHAIN</p>

            <div class="glass-bright rounded-xl p-4 mb-4">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-mono text-gray-500 tracking-widest">VALIDATORS</span>
                    <span class="text-xs font-mono font-bold ${votedCount >= 3 ? 'text-green-400' : 'text-consensus'}">${votedCount}/5</span>
                </div>

                <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                    ${validators.map((v, i) => {
                        const hasVoted = i < votedCount;
                        const isThinking = i === votedCount && !consensusReached;
                        const vote = state.validatorVotes?.[i];
                        const thought = v.thoughts[Math.floor(Math.random() * v.thoughts.length)];
                        return `
                            <div class="flex flex-col items-center relative">
                                ${isThinking ? `
                                    <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-obsidian px-2 py-0.5 rounded-full text-[9px] text-gray-300 whitespace-nowrap animate-pulse border border-white/[0.06]">
                                        ${thought}
                                    </div>
                                ` : ''}
                                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full ${hasVoted ? v.color : 'bg-obsidian border border-white/[0.06]'} flex items-center justify-center text-lg sm:text-xl mb-1 transition-all duration-500 ${hasVoted ? 'scale-110 shadow-lg' : isThinking ? 'animate-glow' : 'opacity-50'}">
                                    ${hasVoted ? '✓' : v.icon}
                                </div>
                                <span class="text-[9px] sm:text-[10px] font-mono ${hasVoted ? 'text-white' : 'text-gray-600'}">${v.name}</span>
                                <span class="text-[9px] text-gray-700 hidden sm:block">${v.taste}</span>
                                ${hasVoted && vote ? `<span class="text-[10px] font-mono text-consensus">#${vote}</span>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="h-1.5 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                    <div class="h-full transition-all duration-500 rounded-full ${votedCount >= 3 ? 'bg-green-500' : 'bg-wit'}"
                         style="width: ${(votedCount / 5) * 100}%"></div>
                </div>
                <p class="text-[10px] font-mono mt-2 tracking-wider ${votedCount >= 3 ? 'text-green-400' : 'text-gray-500'}">
                    ${votedCount >= 3 ? 'MAJORITY CONSENSUS ACHIEVED' : 'AWAITING MAJORITY (3/5)'}
                </p>
            </div>

            ${votedCount > 0 ? `
            <div class="glass-bright rounded-xl p-3 mb-4">
                <p class="text-[10px] font-mono text-gray-600 mb-2 text-left tracking-widest">VOTE DISTRIBUTION</p>
                <div class="space-y-1.5">
                    ${submissions.map((s, idx) => {
                        const sid = s.id || (idx + 1);
                        const count = voteDist[sid] || 0;
                        const pct = votedCount > 0 ? (count / votedCount) * 100 : 0;
                        const isLeading = count === maxVotes && count > 0;
                        return `
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-mono text-gray-500 w-6 text-right">#${sid}</span>
                                <div class="flex-1 h-3 bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                                    <div class="h-full rounded-full transition-all duration-700 ${isLeading ? 'bg-gradient-to-r from-consensus to-consensus-dim' : 'bg-wit/40'}" style="width:${pct}%"></div>
                                </div>
                                <span class="text-[10px] font-mono ${isLeading ? 'text-consensus font-bold' : 'text-gray-600'} w-6">${count}v</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <div class="glass-bright rounded-xl p-3 text-left max-h-32 overflow-y-auto">
                <p class="text-[10px] font-mono text-gray-600 mb-2 tracking-widest">LIVE VALIDATOR FEED</p>
                <div id="validator-feed" class="space-y-1 text-xs font-mono">
                    ${state.validatorVotes?.map((vote, i) => `
                        <div class="flex items-center gap-2 text-gray-400 animate-fadeIn">
                            <span class="text-green-400">OK</span>
                            <span>${validators[i].name} → #${vote}</span>
                        </div>
                    `).join('') || '<div class="text-gray-600">Initializing validators...</div>'}
                    ${consensusReached ? `
                        <div class="flex items-center gap-2 text-green-400 font-bold mt-2 animate-fadeIn tracking-wider">
                            <span>TX</span>
                            <span>CONSENSUS — RECORDING ON-CHAIN</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${consensusReached ? `
            <div class="mt-4 glass-bright rounded-xl p-3 animate-scaleIn">
                <div class="flex items-center justify-center gap-3">
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-sm bg-wit animate-pulse"></div>
                        <div class="w-6 h-0.5 bg-wit/50"></div>
                        <div class="w-3 h-3 rounded-sm bg-wit animate-pulse" style="animation-delay:0.2s"></div>
                        <div class="w-6 h-0.5 bg-green-500/50"></div>
                        <div class="w-3 h-3 rounded-sm bg-green-500 animate-pulse" style="animation-delay:0.4s"></div>
                    </div>
                </div>
                <p class="text-[10px] font-mono text-green-400 mt-1.5 text-center tracking-wider flex items-center justify-center gap-1">${glLogo(11, 'rgb(34,197,94)')} BLOCK CONFIRMED &middot; TX FINALIZED ON GENLAYER</p>
            </div>
            ` : `
            <div class="mt-4 flex items-center justify-center gap-2 text-[10px] font-mono text-gray-600 tracking-wider">
                ${glLogo(12, 'rgb(34,197,94)')}
                <span>CONNECTED TO GENLAYER INTELLIGENT CONTRACTS</span>
            </div>
            `}
        </div>
    `;
}

function renderRoundResults() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const result = r.roundResults[r.roundResults.length - 1];
    if (!result) return renderJudging();
    
    // Determine judging method badge and info
    const judgingMethod = result.judgingMethod || r.lastJudgingMethod || 'ai';
    const isOnChain = judgingMethod === 'genlayer_optimistic_democracy';
    const isAI = judgingMethod === 'claude_api';
    const isAudienceVote = judgingMethod === 'audience_vote' || judgingMethod === 'audience_vote_ai_tiebreak';

    const txHash = result.txHash || null;
    const explorerUrl = txHash ? `https://explorer-bradbury.genlayer.com/transactions/${txHash}` : null;

    const isCoinFlip = judgingMethod === 'coin_flip';
    const methodBadge = isOnChain
        ? `<span class="text-xs bg-green-600 px-2 py-1 rounded-full font-medium">⛓️ On-Chain Verified (Bradbury Testnet)</span>${txHash ? `<a href="${explorerUrl}" target="_blank" class="block text-[10px] text-green-400/70 mt-1 hover:underline">tx: ${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 6)}</a>` : ''}`
        : isAudienceVote
        ? `<span class="text-xs bg-cyan-600 px-2 py-1 rounded-full font-medium">🗳️ Audience Vote${result.totalVotes ? ` (${result.totalVotes} votes)` : ''}${judgingMethod === 'audience_vote_ai_tiebreak' ? ' + AI Tiebreak' : ''}</span>`
        : isAI
        ? '<span class="text-xs bg-purple-600 px-2 py-1 rounded-full font-medium">🤖 AI Judged</span>'
        : isCoinFlip
        ? '<span class="text-xs bg-amber-600 px-2 py-1 rounded-full font-medium">🎲 Oracle Coin Flip — couldn\'t decide!</span>'
        : '<span class="text-xs bg-gray-600 px-2 py-1 rounded-full font-medium">🎲 Fallback</span>';
    
    // Get winner ID
    const winnerId = result.winnerId;
    
    // Generate validator votes if not already generated
    if (!state.validatorVotes || state.validatorVotes.length === 0) {
        const submissions = r.submissions || [];
        const otherIds = submissions.map(s => s.id).filter(id => id !== winnerId);
        state.validatorVotes = [];
        for (let i = 0; i < 5; i++) {
            if (i < 4 || Math.random() > 0.5) {
                state.validatorVotes.push(winnerId);
            } else if (otherIds.length > 0) {
                state.validatorVotes.push(otherIds[Math.floor(Math.random() * otherIds.length)]);
            } else {
                state.validatorVotes.push(winnerId);
            }
        }
    }
    
    const validatorVotes = state.validatorVotes;
    const validators = ['GPT-4', 'Claude', 'LLaMA', 'Gemini', 'Mixtral'];
    const agreedCount = validatorVotes.filter(v => v === winnerId).length;
    
    return `
        <div class="space-y-4">
            <!-- Winner Card -->
            <div class="glow-card glow-card-gold p-6 text-center">
                <p class="text-[10px] font-mono text-consensus/60 tracking-[0.3em] mb-2">ROUND ${result.round} WINNER</p>
                <p class="text-xl font-display font-bold my-2">"${esc(result.winningPunchline)}"</p>
                <p class="text-gray-400 text-sm font-mono">${esc(result.winnerName)}</p>
                <p class="text-green-400 mt-1 font-mono text-sm font-bold">+100 XP</p>
                <div class="mt-2">${methodBadge}</div>
            </div>

            <!-- Optimistic Democracy Summary -->
            <div class="glow-card glow-card-green p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-mono font-bold text-wit tracking-wider">OPTIMISTIC DEMOCRACY</span>
                    <span class="text-[10px] font-mono text-green-400 tracking-wider">CONSENSUS</span>
                </div>
                <div class="flex justify-center gap-3 mb-3">
                    ${validators.map((v, i) => {
                        const vote = validatorVotes[i];
                        const agreed = vote === winnerId;
                        return `
                            <div class="flex flex-col items-center">
                                <div class="w-10 h-10 rounded-full ${agreed ? 'bg-green-500' : 'bg-orange-500'} flex items-center justify-center text-sm font-mono font-bold shadow-lg">
                                    ${agreed ? 'OK' : 'X'}
                                </div>
                                <span class="text-[10px] font-mono text-gray-500 mt-1">${v.split('-')[0]}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <p class="text-[10px] font-mono text-center text-green-400 tracking-wider">
                    ${agreedCount}/5 VALIDATORS AGREED
                </p>
            </div>

            ${result.aiCommentary?.winnerComment ? `
                <div class="glow-card glow-card-amber p-4">
                    <p class="text-[10px] font-mono text-gray-600 mb-1 tracking-widest">ORACLE COMMENTARY</p>
                    <p class="text-consensus/80 italic text-sm">"${esc(result.aiCommentary.winnerComment)}"</p>
                </div>
            ` : ''}

            ${result.isComeback ? `
                <div class="glow-card glow-card-cyan p-4 text-center animate-comeback">
                    <span class="text-lg font-display font-bold text-oracle tracking-wider">COMEBACK</span>
                    <p class="text-xs font-mono text-gray-500 mt-1">${esc(result.winnerName)} from last place</p>
                </div>
            ` : ''}
            ${result.streak >= 2 ? `
                <div class="glow-card glow-card-amber p-3 text-center ${result.streak >= 3 ? 'animate-screenShake' : ''}">
                    <span class="text-sm font-mono font-bold streak-fire text-orange-400 tracking-wider">
                        ${'🔥'.repeat(Math.min(result.streak, 5))} ${result.streak >= 3 ? 'UNSTOPPABLE' : result.streak + '-WIN STREAK'}
                    </span>
                </div>
            ` : ''}

            <!-- Standings -->
            <div class="glow-card p-4">
                <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-3">STANDINGS</p>
                <div class="space-y-2">
                    ${[...r.players].sort((a,b)=>b.score-a.score).map((p,i) => {
                        const change = result.scores?.[p.name] || 0;
                        const streakCount = r.streaks?.[p.name] || 0;
                        return `
                        <div class="flex justify-between items-center p-2.5 ${p.name===state.playerName?'bg-wit/10 border border-wit/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-mono">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
                                <span class="text-sm">${esc(p.name)}</span>
                                ${p.isBot?'<span class="text-[9px] font-mono text-oracle/60 bg-oracle/10 px-1 py-0.5 rounded">BOT</span>':''}
                                ${streakCount >= 2 ? '<span class="text-xs">' + '🔥'.repeat(Math.min(streakCount, 3)) + '</span>' : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                ${change > 0 ? `<span class="text-green-400 text-[10px] font-mono font-bold">+${change}</span>` : change < 0 ? `<span class="text-red-400 text-[10px] font-mono font-bold">${change}</span>` : ''}
                                <span class="text-consensus font-mono font-bold text-sm">${p.score}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>

            <!-- Appeal Mechanic -->
            ${!result.appealed && !state.appealInProgress ? `
                <button onclick="appealVerdict()" class="btn w-full py-3 rounded-xl font-bold text-white text-xs" style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);box-shadow:0 4px 20px rgba(185,28,28,0.3)">
                    APPEAL VERDICT (50 XP) — CHALLENGE THE ORACLE
                </button>
            ` : ''}
            ${state.appealInProgress ? `
                <div class="glow-card glow-card-red p-6 text-center animate-glow">
                    <div class="w-16 h-16 oracle-eye rounded-full flex items-center justify-center mx-auto mb-3 animate-float">
                        <span class="text-2xl">⚖</span>
                    </div>
                    <p class="text-lg font-display font-bold text-red-400 tracking-wider">RE-EVALUATING</p>
                    <p class="text-xs font-mono text-gray-500 mt-1 tracking-wider">10 VALIDATORS — EXTRA SCRUTINY</p>
                    <div class="spinner mx-auto mt-3"></div>
                </div>
            ` : ''}
            ${state.appealResult ? `
                <div class="glow-card ${state.appealResult.overturned ? 'glow-card-green' : 'glow-card-red'} p-6 text-center">
                    <p class="text-lg font-display font-bold tracking-wider ${state.appealResult.overturned ? 'text-green-400' : 'text-red-400'}">
                        ${state.appealResult.overturned ? 'OVERTURNED' : 'UPHELD'}
                    </p>
                    <p class="text-xs font-mono text-gray-500 mt-1">${state.appealResult.overturned ? '50 XP refunded' : '50 XP lost'}</p>
                    ${state.appealResult.onChain ? `
                        <p class="text-[10px] font-mono text-green-400/70 mt-2 tracking-wider">VERIFIED ON GENLAYER BRADBURY TESTNET</p>
                        ${state.appealResult.txHash ? `<a href="https://explorer-bradbury.genlayer.com/transactions/${state.appealResult.txHash}" target="_blank" class="text-[10px] font-mono text-green-400/50 hover:underline">tx: ${state.appealResult.txHash.substring(0, 10)}...</a>` : ''}
                    ` : ''}
                </div>
            ` : ''}
            ${result.appealed && !state.appealResult ? `
                <div class="glow-card p-3 text-center">
                    <p class="text-xs font-mono text-gray-500 tracking-wider">${result.appealResult === 'overturned' ? 'VERDICT OVERTURNED BY APPEAL' : 'APPEAL UPHELD — ORACLE STANDS'}</p>
                </div>
            ` : ''}

            <div class="flex gap-2">
                <button id="challenge-btn" onclick="createChallengeLink()" class="btn btn-ghost flex-1 py-2.5 rounded-xl text-xs text-oracle">CHALLENGE</button>
                <button onclick="shareRoundResult()" class="btn btn-primary flex-1 py-2.5 rounded-xl text-xs text-white">SHARE</button>
            </div>

            ${state.isHost ? `
                <button onclick="nextRound()" onmouseenter="playSound('hover')" class="btn btn-play w-full py-4 rounded-xl font-bold text-sm">
                    ${r.currentRound >= r.totalRounds ? 'FINAL RESULTS' : 'NEXT ROUND'}
                </button>
            ` : '<div class="text-center py-4 text-gray-500 font-mono text-xs tracking-wider"><div class="spinner mx-auto mb-2"></div>WAITING FOR HOST</div>'}
            <button onclick="leaveRoom()" class="btn btn-ghost w-full py-2 rounded-xl text-xs text-gray-500 hover:text-white mt-1">&larr; LEAVE GAME</button>
        </div>
    `;
}

function renderFinalResults() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    const standings = [...r.players].sort((a,b)=>b.score-a.score);
    const winner = standings[0];
    const playerRank = standings.findIndex(p=>p.name===state.playerName)+1;
    const isWinner = playerRank === 1;
    const playerScore = r.players.find(p=>p.name===state.playerName)?.score || 0;

    // Session stats
    let roundsWon = 0, correctBets = 0, totalXP = playerScore, bestJoke = null;
    for (const rr of (r.roundResults || [])) {
        if (rr.winnerName === state.playerName) {
            roundsWon++;
            if (!bestJoke) bestJoke = rr.winningPunchline;
        }
    }

    // Track games today (only increment once per game via flag)
    const todayKey = 'gamesToday_' + getTodayKeyClient();
    if (!state._gameCounted) {
        state._gameCounted = true;
        localStorage.setItem(todayKey, parseInt(localStorage.getItem(todayKey) || '0') + 1);
    }
    const gamesToday = parseInt(localStorage.getItem(todayKey) || '0');

    return `
        <div class="space-y-4">
            <div class="text-center py-6">
                <h2 class="text-3xl font-display font-bold tracking-wider"><span class="gradient-text">GAME COMPLETE</span></h2>
                <p class="text-[10px] font-mono tracking-widest text-gray-500 mt-1 uppercase">${r.totalRounds} rounds played</p>
            </div>
            <div class="glow-card glow-card-gold p-6 text-center">
                <p class="text-[10px] font-mono tracking-widest text-consensus uppercase">Winner</p>
                <p class="text-3xl font-display font-bold mt-1">${esc(winner.name)}</p>
                <p class="text-2xl text-consensus font-mono font-bold mt-1">${winner.score} XP</p>
                ${winner.isBot ? '<p class="text-gray-500 text-[10px] font-mono tracking-wider uppercase mt-1">Autonomous Agent</p>' : ''}
            </div>

            <!-- Session Recap -->
            <div class="glow-card p-4">
                <h3 class="font-display font-bold mb-3 text-center text-wit tracking-wider uppercase text-sm">Session Recap</h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.1s">
                        <p class="text-2xl font-mono font-bold text-consensus">${totalXP}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">XP EARNED</p>
                    </div>
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.2s">
                        <p class="text-2xl font-mono font-bold text-green-400">${roundsWon}/${r.totalRounds}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">ROUNDS WON</p>
                    </div>
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.3s">
                        <p class="text-2xl font-mono font-bold text-blue-400">#${playerRank}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">FINISH</p>
                    </div>
                    <div class="stat-count bg-obsidian border border-white/[0.04] rounded-xl p-2" style="animation-delay:0.4s">
                        <p class="text-2xl font-mono font-bold text-wit">${gamesToday}</p>
                        <p class="text-[10px] font-mono tracking-wider text-gray-500">GAMES TODAY</p>
                    </div>
                </div>
                ${bestJoke ? `<p class="text-center text-sm text-gray-400 mt-3 italic">Best joke: "${esc(bestJoke)}"</p>` : ''}
            </div>

            <!-- Profile Update -->
            ${state.profile ? `
                <div class="glow-card p-4 bg-obsidian border border-white/[0.04]">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-10 h-10 oracle-eye rounded-full flex items-center justify-center font-mono font-bold text-sm">${state.profile.level}</div>
                        <div class="flex-1">
                            <p class="text-sm font-display font-bold">${esc(state.profile.title)}</p>
                            <div class="h-2.5 bg-obsidian rounded-full overflow-hidden mt-1 border border-white/[0.04]">
                                <div class="h-full xp-bar" style="width:${(() => { const lvlXP = [0,0,500,1500,3000,6000,10000,20000,40000,75000,150000][state.profile.level] || 0; return state.nextLevelXP ? Math.min(100, ((state.profile.lifetimeXP - lvlXP) / (state.nextLevelXP - lvlXP)) * 100) : 100; })()}%"></div>
                            </div>
                        </div>
                        <p class="text-consensus font-mono font-bold text-sm">${state.profile.lifetimeXP?.toLocaleString()} XP</p>
                    </div>
                </div>
            ` : ''}

            <div class="glow-card p-4">
                <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">Final Standings</h3>
                <div class="space-y-2">
                    ${standings.map((p,i) => `
                        <div class="flex justify-between items-center p-2.5 ${p.name===state.playerName?'bg-wit/10 border border-wit/20':i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-bold text-sm ${i===0?'text-consensus':i===1?'text-gray-300':i===2?'text-amber-700':'text-gray-500'}">${i<3?['I','II','III'][i]:'#'+(i+1)}</span>
                                <span class="font-display">${esc(p.name)}</span>
                                ${p.isBot?'<span class="text-[10px] font-mono tracking-wider bg-obsidian border border-white/[0.04] px-1.5 py-0.5 rounded-full text-gray-500">BOT</span>':''}
                                ${p.name===state.playerName?'<span class="text-[10px] font-mono tracking-wider bg-wit/20 border border-wit/30 px-1.5 py-0.5 rounded-full text-wit">YOU</span>':''}
                            </div>
                            <span class="text-consensus font-mono font-bold">${p.score} XP</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${isWinner && !winner.isBot ? '<p class="text-center font-display font-bold tracking-wider text-lg text-consensus">VICTORY</p>' : `<p class="text-center text-gray-500 font-mono text-xs tracking-wider uppercase">Finished #${playerRank}</p>`}

            <!-- Share Buttons -->
            <div class="grid grid-cols-3 gap-2">
                <button id="copy-share-btn" onclick="copyShareText(${playerScore},${roundsWon},${r.totalRounds})" class="btn btn-ghost py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider">Copy</button>
                <button onclick="shareFinalResult()" class="btn btn-primary py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white">Share</button>
                <button onclick="tweetResult(${playerScore},${roundsWon},${r.totalRounds})" class="btn py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white" style="background:linear-gradient(135deg,#0284c7,#0369a1);box-shadow:0 4px 15px rgba(2,132,199,0.3)">Tweet</button>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <button onclick="createRoom('${r.category}',${r.isSinglePlayer})" class="btn btn-play py-4 rounded-xl font-display font-bold text-lg uppercase tracking-wider text-white">Rematch</button>
                <button onclick="leaveRoom()" class="btn btn-primary py-4 rounded-xl font-display font-bold text-lg uppercase tracking-wider text-white">Play Again</button>
            </div>
        </div>
    `;
}

function renderDailyChallenge() {
    const dc = state.dailyChallenge;
    if (!dc) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const dr = state.dailyResult;

    if (dc.alreadyPlayed && !dr) {
        return `
            <div class="space-y-4">
                <button onclick="state.screen='lobby';render()" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
                <div class="glow-card glow-card-amber p-8 text-center">
                    <h2 class="text-2xl font-display font-bold mb-2 tracking-wider uppercase">ALREADY COMPLETED</h2>
                    <p class="text-gray-400">Come back tomorrow for a new challenge.</p>
                    ${state.profile?.dailyChallengeStreak > 0 ? `<p class="text-consensus font-mono font-bold mt-3">${state.profile.dailyChallengeStreak}-day streak</p>` : ''}
                    <div class="mt-4 text-[10px] font-mono tracking-wider text-gray-500 uppercase" id="daily-countdown"></div>
                </div>
                ${dc.leaderboard.length > 0 ? `
                    <div class="glow-card p-4">
                        <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">TODAY'S LEADERBOARD</h3>
                        <div class="space-y-2">
                            ${dc.leaderboard.slice(0,10).map((e,i) => `
                                <div class="flex justify-between items-center p-2.5 ${i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                    <span class="font-mono text-sm">${i<3?['I','II','III'][i]:'#'+(i+1)} ${esc(e.name)}</span>
                                    <span class="text-consensus font-mono font-bold">${e.score} XP</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>`;
    }

    if (dr) {
        return `
            <div class="space-y-4">
                <button onclick="state.screen='lobby';state.dailyResult=null;state.dailyChallenge=null;fetchProfile();render()" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
                <div class="glow-card ${dr.won ? 'glow-card-gold' : ''} p-6 text-center">
                    <h2 class="text-2xl font-display font-bold mb-1 tracking-wider uppercase">${dr.won ? 'VICTORY' : 'DEFEATED'}</h2>
                    <p class="text-sm text-gray-400 mb-2">"${esc(dc.prompt)}"</p>
                    <p class="text-lg font-medium">"${esc(dr.winningPunchline)}"</p>
                    <p class="text-[10px] font-mono tracking-wider text-gray-400 uppercase mt-1">by ${esc(dr.winnerName)}</p>
                    ${dr.aiCommentary?.winnerComment ? `<p class="text-consensus/80 text-sm mt-2 italic">"${esc(dr.aiCommentary.winnerComment)}"</p>` : ''}
                    <p class="text-2xl font-display font-bold text-consensus mt-3">+<span class="font-mono">${dr.score}</span> XP</p>
                    ${dr.streak > 0 ? `<p class="text-consensus font-mono font-bold mt-1">${dr.streak}-day streak</p>` : ''}
                </div>
                ${dr.leaderboard?.length > 0 ? `
                    <div class="glow-card p-4">
                        <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">TODAY'S LEADERBOARD</h3>
                        <div class="space-y-2">
                            ${dr.leaderboard.slice(0,10).map((e,i) => `
                                <div class="flex justify-between items-center p-2.5 ${e.name===state.playerName?'bg-wit/10 border border-wit/20':i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                    <span class="font-mono text-sm">${i<3?['I','II','III'][i]:'#'+(i+1)} ${esc(e.name)}</span>
                                    <span class="text-consensus font-mono font-bold">${e.score} XP</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <p class="text-center text-[10px] font-mono tracking-wider text-gray-500 uppercase">Next challenge tomorrow</p>
            </div>`;
    }

    return `
        <div class="space-y-4">
            <button onclick="state.screen='lobby';state.dailyChallenge=null;render()" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
            <div class="glow-card glow-card-amber p-6">
                <div class="text-center mb-4">
                    <h2 class="text-2xl font-display font-bold tracking-wider uppercase">DAILY ORACLE</h2>
                    <p class="text-[10px] font-mono tracking-wider text-gray-400 uppercase mt-1">${dc.date}</p>
                    ${state.profile?.dailyChallengeStreak > 0 ? `<p class="text-consensus font-mono font-bold mt-2">${state.profile.dailyChallengeStreak}-day streak</p>` : ''}
                </div>
                <div class="glow-card p-4 mb-4" style="background:linear-gradient(135deg,rgba(88,28,135,0.2),rgba(157,23,77,0.15),rgba(15,20,35,0.9))">
                    <p class="text-[10px] font-mono tracking-wider text-wit uppercase mb-1">Complete this joke</p>
                    <p class="text-lg font-medium">"${esc(dc.prompt)}"</p>
                </div>
                <textarea id="daily-punchline" maxlength="200" placeholder="Write your funniest punchline..."
                    onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitDailyChallenge()}"
                    class="w-full h-28 px-4 py-3 rounded-xl text-lg resize-none mb-2"></textarea>
                <p class="text-[9px] font-mono text-gray-600/50 mb-3 tracking-wider">CTRL+ENTER TO SUBMIT</p>
                <button onclick="submitDailyChallenge()" ${state.dailySubmitting ? 'disabled' : ''} class="btn btn-play w-full py-4 rounded-xl font-bold text-sm tracking-wider uppercase text-white">
                    ${state.dailySubmitting ? '<span class="spinner inline-block w-5 h-5 mr-2 align-middle"></span>JUDGING...' : 'SUBMIT TO THE ORACLE'}
                </button>
            </div>
            ${dc.leaderboard.length > 0 ? `
                <div class="glow-card p-4">
                    <h3 class="font-display font-bold mb-3 tracking-wider uppercase text-sm">TODAY'S LEADERBOARD</h3>
                    <div class="space-y-2">
                        ${dc.leaderboard.slice(0,10).map((e,i) => `
                            <div class="flex justify-between items-center p-2.5 ${i<3?'bg-consensus/10 border border-consensus/20':'bg-obsidian border border-white/[0.04]'} rounded-xl">
                                <span class="font-mono text-sm">${i<3?['I','II','III'][i]:'#'+(i+1)} ${esc(e.name)}</span>
                                <span class="text-consensus font-mono font-bold">${e.score} XP</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>`;
}

function renderProfileScreen() {
    const p = state.profile;
    if (!p) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-circle mx-auto" style="width:80px;height:80px"></div><div class="skeleton skeleton-text mx-auto" style="width:40%"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:140px"></div></div>';
    const nextXP = state.nextLevelXP;
    const currentLevelXP = [0,0,500,1500,3000,6000,10000,20000,40000,75000,150000][p.level] || 0;
    const progress = nextXP ? Math.min(100, ((p.lifetimeXP - currentLevelXP) / (nextXP - currentLevelXP)) * 100) : 100;
    const winRate = p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0;

    return `
        <div class="space-y-4">
            <button onclick="state.screen='lobby';render()" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs">&larr; Back to Lobby</button>
            <div class="glow-card p-6 text-center">
                <div class="w-20 h-20 rounded-full oracle-eye flex items-center justify-center mx-auto mb-3 text-3xl font-bold">${p.level}</div>
                <h2 class="text-2xl font-display font-bold">${esc(p.name)}</h2>
                <p class="text-wit font-mono font-medium">${esc(p.title)}</p>
                <p class="text-consensus font-mono text-xl font-bold mt-2">${p.lifetimeXP.toLocaleString()} XP</p>
                <div class="max-w-xs mx-auto mt-3">
                    <div class="flex justify-between text-[10px] font-mono tracking-wider text-gray-400 mb-1">
                        <span>Lv.${p.level}</span>
                        <span>${nextXP ? 'Lv.' + (p.level + 1) : 'MAX'}</span>
                    </div>
                    <div class="h-3 bg-obsidian border border-white/[0.04] rounded-full overflow-hidden">
                        <div class="h-full xp-bar" style="width:${progress}%"></div>
                    </div>
                    <p class="text-[10px] font-mono text-gray-500 mt-1">${nextXP ? (nextXP - p.lifetimeXP).toLocaleString() + ' XP to next level' : 'Maximum level reached!'}</p>
                </div>
            </div>

            <div class="glow-card p-4">
                <h3 class="text-[10px] font-mono tracking-widest uppercase text-gray-400 mb-3">Statistics</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-white">${p.gamesPlayed}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Games Played</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-green-400">${p.gamesWon}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Games Won</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-consensus">${p.roundsWon}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Rounds Won</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-wit">${winRate}%</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Win Rate</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-orange-400">${p.bestStreak}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Best Streak</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center">
                        <p class="text-xl font-bold text-blue-400">${p.totalCorrectBets}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Correct Bets</p>
                    </div>
                    <div class="bg-obsidian border border-white/[0.04] rounded-xl p-3 text-center col-span-2">
                        <p class="text-xl font-bold text-amber-400">${p.dailyChallengeStreak}</p>
                        <p class="text-[10px] font-mono text-gray-500 tracking-wider">Daily Challenge Streak</p>
                    </div>
                </div>
            </div>

            ${p.achievements.length > 0 ? `
                <div class="glow-card p-4">
                    <h3 class="text-[10px] font-mono tracking-widest uppercase text-gray-400 mb-3">Achievements (${p.achievements.length}/${state.allAchievements.length})</h3>
                    <div class="grid grid-cols-3 gap-2">
                        ${state.allAchievements.map(a => {
                            const unlocked = p.achievements.includes(a.id);
                            return `
                                <div class="rounded-xl p-2.5 text-center ${unlocked ? 'bg-consensus/10 border border-consensus/30' : 'bg-obsidian/80 border border-white/[0.04] opacity-40'}">
                                    <span class="text-2xl">${a.icon}</span>
                                    <p class="text-xs ${unlocked ? 'text-white' : 'text-gray-500'} mt-1">${a.name}</p>
                                </div>`;
                        }).join('')}
                    </div>
                </div>
            ` : `
                <div class="glow-card p-4">
                    <h3 class="text-[10px] font-mono tracking-widest uppercase text-gray-400 mb-3">Achievements</h3>
                    <div class="grid grid-cols-3 gap-2">
                        ${state.allAchievements.map(a => `
                            <div class="rounded-xl p-2.5 text-center bg-obsidian/80 border border-white/[0.04] opacity-40">
                                <span class="text-2xl">${a.icon}</span>
                                <p class="text-xs text-gray-500 mt-1">${a.name}</p>
                            </div>
                        `).join('')}
                    </div>
                    <p class="text-center text-gray-500 text-sm mt-3">Play games to unlock achievements!</p>
                </div>
            `}
        </div>`;
}

function renderHallOfFame() {
    return `
        <div class="space-y-4">
            <button onclick="state.screen='lobby';state.showHallOfFame=false;render()" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-sm">&larr; Back to Lobby</button>
            <div class="text-center">
                <h2 class="text-2xl font-display font-bold tracking-wider"><span class="gradient-text">HALL OF FAME</span></h2>
                <p class="text-xs font-mono text-gray-500 tracking-wider">The Oracle's finest judgments</p>
            </div>
            ${state.hallOfFame.length > 0 ? `
                <div class="space-y-3">
                    ${state.hallOfFame.map((j, i) => `
                        <div class="glow-card ${i < 3 ? 'glow-card-gold' : ''} p-4">
                            <div class="flex items-start gap-3">
                                <span class="text-lg shrink-0">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span>
                                <div class="flex-1">
                                    <p class="text-sm text-gray-400">"${esc(j.prompt)}"</p>
                                    <p class="text-white font-medium mt-1">"${esc(j.punchline)}"</p>
                                    <div class="flex justify-between items-center mt-2">
                                        <span class="text-xs text-consensus">by ${esc(j.author)}</span>
                                        ${j.commentary ? `<span class="text-xs text-gray-500 italic">${esc(j.commentary)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-gray-500 text-center py-8">No winning jokes recorded yet. Play to be the first!</p>'}
        </div>`;
}

// --- Render: Community Prompts ---
function renderCommunityPrompts() {
    return `
        <div class="space-y-4">
            <button onclick="state.screen='lobby';state.showCommunityPrompts=false;render()" class="btn btn-ghost px-3 py-1.5 rounded-lg text-gray-400 text-sm">&larr; Back to Lobby</button>
            <div class="text-center">
                <h2 class="text-2xl font-display font-bold tracking-wider"><span class="gradient-text">COMMUNITY PROMPTS</span></h2>
                <p class="text-xs font-mono text-gray-500 tracking-wider">Submit joke setups. Top-voted enter the game rotation!</p>
            </div>

            <!-- Submit form -->
            <div class="glow-card glow-card-cyan p-5">
                <h3 class="text-[10px] font-mono tracking-widest text-gray-400 mb-2">SUBMIT A JOKE SETUP</h3>
                <textarea id="community-prompt-input" rows="2" maxlength="150" placeholder="e.g. Why do blockchain developers..."
                    onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submitCommunityPrompt()}"
                    class="w-full px-3 py-2 rounded-xl text-sm resize-none"></textarea>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs text-gray-500">10-150 characters</span>
                    <button onclick="submitCommunityPrompt()" class="btn btn-primary px-4 py-1.5 rounded-lg text-sm font-bold text-white">Submit</button>
                </div>
            </div>

            <!-- Prompt list -->
            ${state.communityPrompts.length > 0 ? `
                <div class="space-y-2">
                    ${state.communityPrompts.map((p, i) => `
                        <div class="glow-card ${p.status === 'approved' ? 'glow-card-green' : ''} p-4">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1">
                                    <p class="text-white text-sm font-medium">"${esc(p.prompt)}"</p>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-xs text-gray-500">by ${esc(p.author || 'Anon')}</span>
                                        ${p.status === 'approved' ? '<span class="text-xs text-green-400 font-bold">IN ROTATION</span>' : ''}
                                        ${p.status === 'pending' ? '<span class="text-[10px] font-mono text-consensus tracking-wider">NEEDS ' + (5 - (p.votes || 0)) + ' MORE</span>' : ''}
                                    </div>
                                </div>
                                <button onclick="voteCommunityPrompt('${p.id}')" class="btn btn-ghost px-3 py-2 rounded-lg text-center shrink-0" ${p.status === 'approved' ? 'disabled' : ''}>
                                    <span class="text-lg block">👍</span>
                                    <span class="text-xs text-gray-400">${p.votes || 0}</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-gray-500 text-center py-8">No submissions yet. Be the first!</p>'}
        </div>
    `;
}

