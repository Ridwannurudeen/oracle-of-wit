/**
 * @module render-lobby
 * @description Lobby screen renderers: welcome, lobby, and waiting room.
 */

import { state } from './state.js';
import { esc, glLogo, renderProfileCard, getTodayKeyClient } from './render-helpers.js';

/**
 * Render the welcome/landing screen with protocol info and login form.
 * @returns {string} HTML string.
 */
export function renderWelcome() {
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
                    <input type="text" id="player-name-input" placeholder="Enter your name..." value="${esc(state.playerName)}"
                        data-action-input="playerNameInput"
                        data-action-blur="playerNameBlur"
                        data-action-focus="playerNameFocus"
                        data-action-keypress="playerNameKeypress"
                        class="w-full px-5 py-4 rounded-xl mb-5 text-base">
                    <div id="boot-container">
                        <button id="boot-btn" data-action="startBootSequence" data-hover-sound="true" class="btn btn-primary w-full py-4 rounded-xl text-sm text-white" style="box-shadow: 0 4px 30px rgba(168,85,247,0.3), inset 0 1px 0 rgba(255,255,255,0.1);font-size:0.9rem">
                            INITIALIZE SESSION
                        </button>
                    </div>
                    <div data-island="wallet-button" class="mt-3"></div>
                </div>
                <div class="mt-4 text-center">
                    <a href="https://www.genlayer.com" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[10px] font-mono text-oracle/40 hover:text-oracle transition-colors tracking-wider"><span class="opacity-60">${glLogo(14, 'rgb(45,212,191)')}</span>POWERED BY GENLAYER &rarr;</a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the game lobby with solo/multiplayer modes, daily challenge,
 * community prompts, and leaderboard/hall of fame tabs.
 * @returns {string} HTML string.
 */
export function renderLobby() {
    const gamesPlayedToday = parseInt(localStorage.getItem('gamesToday_' + getTodayKeyClient()) || '0');

    // Initialize room settings state if not present
    if (!state.roomSettings) {
        state.roomSettings = {
            totalRounds: null,
            submissionTime: null,
            bettingTime: null,
            isPrivate: false,
            botDifficulty: 'easy',
            showAdvanced: false
        };
    }
    const rs = state.roomSettings;

    /** Helper: render a pill-button group */
    const pillGroup = (key, options, unit = '') => options.map(opt => {
        const isActive = rs[key] === opt.value;
        return `<button data-action="setRoomSetting" data-setting-key="${key}" data-setting-value="${opt.value}"
            class="px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-wider transition-all cursor-pointer
            ${isActive
                ? 'bg-wit/20 text-wit border border-wit/40'
                : 'bg-obsidian text-gray-500 border border-white/[0.06] hover:border-wit/25 hover:text-gray-300'}">${opt.label}${unit}</button>`;
    }).join('');

    /** Helper: render bot difficulty selector */
    const botDifficultySelector = () => {
        const difficulties = [
            { value: 'easy', label: 'EASY', color: 'green' },
            { value: 'medium', label: 'MEDIUM', color: 'consensus' },
            { value: 'hard', label: 'HARD', color: 'red' }
        ];
        return `
            <div class="mb-4">
                <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">BOT DIFFICULTY</p>
                <div class="flex gap-2">
                    ${difficulties.map(d => {
                        const isActive = rs.botDifficulty === d.value;
                        const colorMap = { green: 'green-400', consensus: 'consensus', red: 'red-400' };
                        const bgMap = { green: 'green-500/15', consensus: 'consensus/15', red: 'red-500/15' };
                        const borderMap = { green: 'green-500/30', consensus: 'consensus/30', red: 'red-500/30' };
                        return `<button data-action="setRoomSetting" data-setting-key="botDifficulty" data-setting-value="${d.value}"
                            class="flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wider transition-all cursor-pointer
                            ${isActive
                                ? `bg-${bgMap[d.color]} text-${colorMap[d.color]} border border-${borderMap[d.color]}`
                                : 'bg-obsidian text-gray-500 border border-white/[0.06] hover:border-white/15 hover:text-gray-400'}">${d.label}</button>`;
                    }).join('')}
                </div>
            </div>`;
    };

    /** Helper: render advanced settings panel for multiplayer */
    const advancedSettingsPanel = () => `
        <div class="mt-4">
            <button data-action="toggleAdvancedSettings" class="flex items-center gap-2 text-[10px] font-mono text-gray-500 tracking-widest hover:text-gray-300 transition-colors cursor-pointer w-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                    style="transform:rotate(${rs.showAdvanced ? '90deg' : '0deg'});transition:transform 0.2s">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
                ROOM SETTINGS
            </button>
            ${rs.showAdvanced ? `
                <div class="mt-3 p-4 bg-obsidian/50 border border-white/[0.04] rounded-xl space-y-4">
                    <!-- Round Count -->
                    <div>
                        <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">ROUNDS</p>
                        <div class="flex gap-2">
                            ${pillGroup('totalRounds', [
                                { value: 3, label: '3' },
                                { value: 5, label: '5' },
                                { value: 7, label: '7' },
                                { value: 10, label: '10' }
                            ])}
                        </div>
                    </div>
                    <!-- Submission Time -->
                    <div>
                        <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">SUBMISSION TIME</p>
                        <div class="flex gap-2">
                            ${pillGroup('submissionTime', [
                                { value: 30000, label: '30s' },
                                { value: 45000, label: '45s' },
                                { value: 60000, label: '60s' }
                            ])}
                        </div>
                    </div>
                    <!-- Betting Time -->
                    <div>
                        <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">BETTING TIME</p>
                        <div class="flex gap-2">
                            ${pillGroup('bettingTime', [
                                { value: 20000, label: '20s' },
                                { value: 30000, label: '30s' },
                                { value: 45000, label: '45s' }
                            ])}
                        </div>
                    </div>
                    <!-- Private Room Toggle -->
                    <div class="flex items-center justify-between">
                        <p class="text-[10px] font-mono text-gray-600 tracking-widest">PRIVATE ROOM</p>
                        <button data-action="setRoomSetting" data-setting-key="isPrivate" data-setting-value="${rs.isPrivate ? 'false' : 'true'}"
                            class="relative w-10 h-5 rounded-full transition-all cursor-pointer ${rs.isPrivate ? 'bg-wit/30 border border-wit/40' : 'bg-obsidian border border-white/[0.08]'}">
                            <span class="absolute top-0.5 ${rs.isPrivate ? 'left-5' : 'left-0.5'} w-4 h-4 rounded-full transition-all ${rs.isPrivate ? 'bg-wit' : 'bg-gray-600'}"></span>
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>`;

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
                        <span class="text-4xl">${esc(state.currentWeeklyTheme.emoji)}</span>
                        <div class="flex-1">
                            <p class="text-[10px] font-mono text-wit tracking-widest mb-1">THIS WEEK'S THEME</p>
                            <p class="font-display font-bold text-xl tracking-wider">${esc(state.currentWeeklyTheme.name)}</p>
                            <p class="text-sm text-gray-400 mt-1">${esc(state.currentWeeklyTheme.description)}</p>
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
                    <p class="text-gray-500 text-xs font-mono mb-4">Practice against oracle-calibrated bots</p>

                    <!-- Bot Difficulty Selector -->
                    ${botDifficultySelector()}

                    <div class="grid grid-cols-3 gap-3">
                        <button data-action="createRoom" data-category="tech" data-single-player="true" class="btn cat-btn p-4 bg-gradient-to-br from-blue-900/80 to-cyan-900/80 rounded-xl text-white border border-cyan-500/30 hover:border-cyan-400/50 transition-all">
                            <span class="text-2xl block mb-1.5">&#129302;</span><span class="text-[10px] font-mono tracking-wider font-bold">TECH</span>
                        </button>
                        <button data-action="createRoom" data-category="crypto" data-single-player="true" class="btn cat-btn p-4 bg-gradient-to-br from-amber-900/80 to-orange-900/80 rounded-xl text-white border border-amber-500/30 hover:border-amber-400/50 transition-all">
                            <span class="text-2xl block mb-1.5">&#128142;</span><span class="text-[10px] font-mono tracking-wider font-bold">CRYPTO</span>
                        </button>
                        <button data-action="createRoom" data-category="general" data-single-player="true" class="btn cat-btn p-4 bg-gradient-to-br from-purple-900/80 to-pink-900/80 rounded-xl text-white border border-purple-500/30 hover:border-purple-400/50 transition-all">
                            <span class="text-2xl block mb-1.5">&#128514;</span><span class="text-[10px] font-mono tracking-wider font-bold">GENERAL</span>
                        </button>
                    </div>

                    <!-- Speed Mode -->
                    <button data-action="createRoom" data-category="general" data-single-player="true" data-speed-mode="true"
                        class="btn w-full mt-4 py-2.5 rounded-xl text-[10px] font-mono font-bold tracking-wider transition-all
                        bg-gradient-to-r from-consensus/10 to-orange-500/10 border border-consensus/25 text-consensus hover:border-consensus/50 hover:text-white">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="inline-block mr-1.5 align-[-2px]"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>SPEED MODE
                    </button>
                </div>

                <!-- Multiplayer -->
                <div class="glow-card p-6">
                    <div class="flex items-center gap-2 mb-2">
                        <h3 class="text-xl font-display font-bold tracking-wider">MULTIPLAYER</h3>
                        <span class="text-[9px] font-mono text-wit/60 bg-wit/10 px-2 py-0.5 rounded border border-wit/20">2-100</span>
                    </div>
                    <p class="text-gray-500 text-xs font-mono mb-5">Create a room and invite players</p>
                    <div class="grid grid-cols-3 gap-3 mb-4">
                        <button data-action="createRoom" data-category="tech" data-single-player="false" class="btn cat-btn p-4 bg-obsidian rounded-xl text-white border border-white/[0.06] hover:border-wit/30 transition-all">
                            <span class="text-2xl block mb-1.5">&#129302;</span><span class="text-[10px] font-mono text-gray-400 font-bold">TECH</span>
                        </button>
                        <button data-action="createRoom" data-category="crypto" data-single-player="false" class="btn cat-btn p-4 bg-obsidian rounded-xl text-white border border-white/[0.06] hover:border-wit/30 transition-all">
                            <span class="text-2xl block mb-1.5">&#128142;</span><span class="text-[10px] font-mono text-gray-400 font-bold">CRYPTO</span>
                        </button>
                        <button data-action="createRoom" data-category="general" data-single-player="false" class="btn cat-btn p-4 bg-obsidian rounded-xl text-white border border-white/[0.06] hover:border-wit/30 transition-all">
                            <span class="text-2xl block mb-1.5">&#128514;</span><span class="text-[10px] font-mono text-gray-400 font-bold">GENERAL</span>
                        </button>
                    </div>

                    <!-- Advanced Room Settings (collapsible) -->
                    ${advancedSettingsPanel()}

                    <div class="flex gap-2 mt-4">
                        <input type="text" id="room-code" placeholder="Enter room code..."
                            data-action-keypress="roomCodeKeypress"
                            class="flex-1 px-4 py-2.5 rounded-xl uppercase">
                        <button data-action="joinRoomFromInput" class="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-white">Join</button>
                    </div>

                    ${state.publicRooms.length > 0 ? `
                        <div class="mt-4 space-y-2">
                            <p class="text-[10px] font-mono text-gray-600 tracking-widest">OPEN ROOMS</p>
                            ${state.publicRooms.map(r => `
                                <div class="flex justify-between items-center p-2.5 bg-obsidian border border-white/[0.04] rounded-xl">
                                    <div>
                                        <span class="font-mono text-wit">${esc(r.id)}</span>
                                        ${r.status !== 'waiting' ? `<span class="text-xs ml-1 ${r.status === 'finished' ? 'text-gray-500' : 'text-green-400'}">R${r.currentRound}/${r.totalRounds}</span>` : ''}
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs text-gray-400">${r.players}p${r.spectators ? ' '+r.spectators+'s' : ''}</span>
                                        ${r.status === 'waiting' ? `
                                            <button data-action="joinRoom" data-room-id="${esc(r.id)}" class="btn btn-primary px-3 py-1 rounded-lg text-sm text-white">Join</button>
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
                        ${state.profile?.dailyChallengeStreak > 0 ? `<span class="text-consensus font-mono text-sm font-bold">${'\uD83D\uDD25'.repeat(Math.min(state.profile.dailyChallengeStreak, 5))} ${state.profile.dailyChallengeStreak}d</span>` : ''}
                    </div>
                    <button data-action="fetchDailyChallenge" data-hover-sound="true" class="btn btn-play w-full py-3 rounded-xl text-sm">
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
                    <button data-action="fetchCommunityPrompts" data-hover-sound="true" class="btn btn-teal w-full py-3 rounded-xl text-sm text-white">SUBMIT PROMPT</button>
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
                        <button data-action="createRoom" data-category="${esc(state.challengeData.category)}" data-single-player="true" class="btn btn-teal px-5 py-2.5 rounded-xl text-xs text-white font-bold">ACCEPT</button>
                    </div>
                </div>
            ` : ''}

            <!-- Leaderboard / Hall of Fame -->
            <div class="flex gap-1 mb-0" role="tablist">
                <button data-action="showLeaderboardTab" role="tab" aria-selected="${!state.showHallOfFame}" class="btn flex-1 py-2.5 ${!state.showHallOfFame ? 'tab-active' : 'tab-inactive'} rounded-t-xl text-[10px] font-mono tracking-wider">LEADERBOARD</button>
                <button data-action="showHallOfFameTab" role="tab" aria-selected="${state.showHallOfFame}" class="btn flex-1 py-2.5 ${state.showHallOfFame ? 'tab-active' : 'tab-inactive'} rounded-t-xl text-[10px] font-mono tracking-wider">HALL OF FAME</button>
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
                                    <span class="text-lg">${i===0?'\uD83E\uDD47':i===1?'\uD83E\uDD48':i===2?'\uD83E\uDD49':'#'+(i+1)}</span>
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

/**
 * Render the waiting room with player list, room code, and start button.
 * @returns {string} HTML string.
 */
export function renderWaiting() {
    if (!state.room) return '<div class="space-y-4 py-8"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card" style="height:120px"></div><div class="skeleton skeleton-text" style="width:60%;margin:0 auto"></div></div>';
    const r = state.room;
    return `
        <div class="glow-card p-6">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h2 class="text-xl font-display font-bold tracking-wider">${r.isSinglePlayer ? 'SOLO MODE' : esc(r.id)}</h2>
                    <span class="text-[10px] font-mono ${r.isSinglePlayer ? 'text-consensus/60' : 'text-oracle/60'} tracking-widest">${r.isSinglePlayer ? 'VS ORACLE BOTS' : 'AWAITING PLAYERS'}</span>
                </div>
                <button data-action="leaveRoom" class="btn btn-ghost px-3 py-2 rounded-lg text-gray-500 hover:text-white text-lg">&#10005;</button>
            </div>

            ${!r.isSinglePlayer ? `
                <div class="mb-4 p-4 bg-obsidian rounded-xl text-center border border-white/[0.04]">
                    <p class="text-[10px] font-mono text-gray-600 tracking-widest mb-2">ROOM CODE</p>
                    <div class="flex items-center justify-center gap-2">
                        <p class="font-mono text-2xl text-wit select-all tracking-wider">${esc(r.id)}</p>
                        <button data-action="copyRoomCode" data-room-id="${esc(r.id)}" class="btn btn-ghost p-2 rounded-lg text-gray-400" title="Copy code" aria-label="Copy room code">
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

            ${r.chainTxHashes?.create ? `
                <div class="mb-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-green-500"></div>
                    <span class="text-[10px] font-mono text-green-400 tracking-wider flex-1">REGISTERED ON GENLAYER</span>
                    <a href="https://explorer-bradbury.genlayer.com/transactions/${r.chainTxHashes.create}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-mono text-green-400/60 hover:underline">${r.chainTxHashes.create.substring(0, 10)}...</a>
                </div>
            ` : r.chainTxHashes && !r.chainTxHashes.create ? `
                <div class="mb-3 p-3 bg-oracle/10 border border-oracle/20 rounded-xl flex items-center gap-2">
                    <div class="spinner w-3 h-3"></div>
                    <span class="text-[10px] font-mono text-oracle/60 tracking-wider">REGISTERING ON-CHAIN...</span>
                </div>
            ` : ''}

            ${state.isHost ? `
                <button data-action="startGame" data-hover-sound="true" ${!r.isSinglePlayer && r.players.length<2 || state.loading ? 'disabled' : ''}
                    class="btn btn-play w-full py-4 rounded-xl font-bold text-sm">
                    ${state.loading ? '<span class="spinner inline-block w-5 h-5 mr-2 align-middle"></span>INITIALIZING...' : !r.isSinglePlayer && r.players.length<2 ? 'NEED 2+ PLAYERS' : 'INITIALIZE GAME'}
                </button>
            ` : '<div class="text-center py-4 text-gray-500 font-mono text-xs tracking-wider"><div class="spinner mx-auto mb-2"></div>WAITING FOR HOST</div>'}
        </div>
    `;
}
