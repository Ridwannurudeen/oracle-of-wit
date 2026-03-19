// Oracle of Wit — API, Polling, Helpers (ES Module)

import { state, pollInterval, setPollInterval, sessionToken } from './state.js';
import { formatTime } from './render-helpers.js';

export const API_URL = '/api/game';

// Phase-based polling intervals (ms)
const POLL_INTERVALS = {
    lobby: 5000,        // 5s — lobby is low-activity
    waiting: 3000,      // 3s — waiting for players
    submitting: 2000,   // 2s — active phase
    betting: 2000,      // 2s — active phase
    judging: 1500,      // 1.5s — want fast updates during judging
    voting: 2000,       // 2s — active phase
    roundResults: 4000, // 4s — viewing results, low urgency
    finished: 10000,    // 10s — game is over
    idle: 10000,        // 10s — no active game (profile, daily, etc.)
};
const HIDDEN_TAB_INTERVAL = 30000; // 30s when tab is hidden

let currentPollInterval = POLL_INTERVALS.waiting;
let pollBackoff = 1;
export let soundEnabled = true;
export function setSoundEnabled(val) { soundEnabled = val; }
export let audioCtx = null;
export function setAudioCtx(val) { audioCtx = val; }
export let isTyping = false; // Track if user is typing
export function setIsTyping(val) { isTyping = val; }
export let typingTimeout = null;
export function setTypingTimeout(val) { typingTimeout = val; }

// ETag/change detection — skip render when room data hasn't changed
let lastRoomHash = null;

// Late-binding references to avoid circular imports
let _render = null;
let _leaveRoom = null;
let _renderLeftWingContent = null;
let _renderRightWingContent = null;
let _handlePhaseChange = null;
let _syncTimer = null;

export function bindRender(fn) { _render = fn; }
export function bindLeaveRoom(fn) { _leaveRoom = fn; }
export function bindRenderLeftWingContent(fn) { _renderLeftWingContent = fn; }
export function bindRenderRightWingContent(fn) { _renderRightWingContent = fn; }
export function bindHandlePhaseChange(fn) { _handlePhaseChange = fn; }
export function bindSyncTimer(fn) { _syncTimer = fn; }

function simpleHash(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

// Adaptive polling based on game phase + player count
function getAdaptivePollInterval() {
    // Non-game screens — idle polling
    const nonGameScreens = ['welcome', 'lobby', 'profile', 'daily', 'community', 'hallOfFame', 'leaderboard'];
    if (!state.roomId && nonGameScreens.includes(state.screen)) {
        return POLL_INTERVALS.idle;
    }

    // In a room — use room status
    const roomStatus = state.room?.status;
    let base = POLL_INTERVALS[roomStatus] || POLL_INTERVALS.waiting;

    // Scale up slightly for very large rooms to reduce server load
    const playerCount = state.room?.players?.length || 0;
    if (playerCount > 50) base = Math.max(base, 3000);
    else if (playerCount > 20) base = Math.max(base, 2500);

    return base;
}

// Visibility-based polling — slow down when tab is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Tab hidden — slow polling to 30s
        stopPolling();
        setPollInterval(setTimeout(pollLoop, HIDDEN_TAB_INTERVAL));
    } else {
        // Tab visible — resume immediately with fresh data
        stopPolling();
        if (state.roomId) {
            startPolling(); // startPolling calls fetchRoom + scheduleNextPoll
        }
    }
});

function pollLoop() {
    fetchRoom();
    if (state.roomId) {
        scheduleNextPoll();
    }
}

// Mark user as typing (prevents full re-renders)
export function setTyping() {
    isTyping = true;
    if (typingTimeout) clearTimeout(typingTimeout);
    // Keep typing flag active for 3 seconds after last keystroke
    typingTimeout = setTimeout(() => { isTyping = false; }, 3000);
}

// Update ONLY the timer display without re-rendering everything
export function updateTimerDisplay() {
    const timerEl = document.getElementById('timer-display');
    const timerBar = document.getElementById('timer-bar');
    const timerWarning = document.getElementById('timer-warning');

    if (timerEl) {
        const isLow = state.timeLeft <= 10;
        timerEl.textContent = formatTime(state.timeLeft);
        timerEl.className = `text-3xl font-mono font-bold ${isLow ? 'countdown-critical text-red-500' : 'text-white'}`;
    }
    if (timerBar) {
        const max = state.screen === 'submitting' ? 40 : state.screen === 'voting' ? 20 : 30;
        const pct = (state.timeLeft / max) * 100;
        const isLow = state.timeLeft <= 10;
        timerBar.style.width = `${pct}%`;
        timerBar.className = `h-full timer-bar rounded-full ${isLow ? 'bg-red-500' : 'bg-gradient-to-r from-wit to-oracle'}`;
    }
    if (timerWarning) {
        timerWarning.style.display = state.timeLeft <= 10 ? 'block' : 'none';
    }
}

// Lightweight DOM patches for polls — avoids full innerHTML rebuild while typing
export function updateHUDPartials(subCount, playerCount, betCount) {
    // Update submission/bet counters if visible
    const submittedEl = document.querySelector('[data-hud="submitted"]');
    if (submittedEl) {
        const humanPlayers = state.room?.players?.filter(p => !p.isBot).length || 0;
        submittedEl.textContent = `${subCount}/${humanPlayers} SUBMITTED`;
    }
    const betEl = document.querySelector('[data-hud="bets"]');
    if (betEl) {
        const humanPlayers = state.room?.players?.filter(p => !p.isBot).length || 0;
        betEl.textContent = `${betCount}/${humanPlayers} BET`;
    }
    // Update wing content (player list, activity)
    const leftWing = document.querySelector('[data-hud="left-wing"]');
    if (leftWing && _renderLeftWingContent) leftWing.innerHTML = _renderLeftWingContent();
    const rightWing = document.querySelector('[data-hud="right-wing"]');
    if (rightWing && _renderRightWingContent) rightWing.innerHTML = _renderRightWingContent();
}

// Update character count without re-rendering
export function updateCharCount() {
    const charCount = document.getElementById('char-count');
    if (charCount) {
        const len = state.punchlineText.length;
        charCount.textContent = `${len}/200`;
        charCount.className = `text-[10px] font-mono tracking-wider ${len >= 180 ? 'text-red-400 font-bold' : len >= 140 ? 'text-consensus' : 'text-gray-600'}`;
    }
}

// === API CALL WRAPPER ===
export async function api(action, data = {}) {
    state.loading = true;
    state.error = null;
    // Don't render during loading if user is typing
    if (!isTyping && _render) _render();
    try {
        const res = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, sessionToken })
        });
        const result = await res.json();
        state.loading = false;
        if (!res.ok || result.error) throw new Error(result.error || 'Error');

        // After successful mutating action, trigger immediate poll
        const MUTATING_ACTIONS = new Set(['submitPunchline', 'placeBet', 'castVote', 'sendReaction', 'advancePhase', 'startGame']);
        if (MUTATING_ACTIONS.has(action) && state.roomId) {
            setTimeout(() => fetchRoom(), 100); // slight delay to let server process
        }

        return result;
    } catch (e) {
        state.loading = false;
        state.error = e.message;
        if (_render) _render(true); // Force render to show error
        throw e;
    }
}

export async function fetchRoom() {
    if (!state.roomId) return;
    try {
        const res = await fetch(`${API_URL}?action=getRoom&roomId=${state.roomId}`);
        const result = await res.json();
        if (!result.success || !result.room) {
            // Room expired on server — auto-recover
            if (_leaveRoom) _leaveRoom();
            state.error = 'Room expired. Returned to lobby.';
            if (_render) _render(true);
            return;
        }
        pollBackoff = 1; // Reset backoff on success
        updateConnectionBanner();
        if (result.success && result.room) {
            // Change detection — skip render if room data unchanged
            const newHash = simpleHash(result.room);
            if (newHash === lastRoomHash) {
                // Data unchanged — skip render, just update timer
                if (_syncTimer) _syncTimer();
                updateTimerDisplay();
                return;
            }
            lastRoomHash = newHash;

            const oldStatus = state.room?.status;
            const oldSubmissionCount = state.room?.submissions?.length || 0;
            const oldBetCount = state.room?.bets?.length || 0;
            const oldPlayerCount = state.room?.players?.length || 0;

            state.room = result.room;
            if (_syncTimer) _syncTimer();

            // Render on phase change even when typing
            if (state.room.status !== oldStatus) {
                isTyping = false;
                if (_handlePhaseChange) _handlePhaseChange(oldStatus, state.room.status);
                if (_render) _render(true); // Force render on phase change
                return;
            }

            // Check if something important changed
            const newSubmissionCount = state.room?.submissions?.length || 0;
            const newBetCount = state.room?.bets?.length || 0;
            const newPlayerCount = state.room?.players?.length || 0;

            const hasImportantChange =
                newSubmissionCount !== oldSubmissionCount ||
                newBetCount !== oldBetCount ||
                newPlayerCount !== oldPlayerCount;

            if (hasImportantChange) {
                // During active input phases, do lightweight DOM patches instead of full rebuild
                if (isTyping || document.activeElement?.id === 'punchline') {
                    updateHUDPartials(newSubmissionCount, newPlayerCount, newBetCount);
                } else {
                    if (_render) _render();
                }
            }
            // Always update timer display
            updateTimerDisplay();
        }
    } catch (e) {
        pollBackoff = Math.min(pollBackoff * 2, 8);
        console.warn(`[Poll] fetchRoom failed (backoff=${pollBackoff}x):`, e.message);
        updateConnectionBanner();
    }
}

// Show/hide connection degradation banner
export function updateConnectionBanner() {
    let banner = document.getElementById('connection-banner');
    if (pollBackoff > 1) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'connection-banner';
            banner.className = 'fixed top-0 left-0 right-0 z-50 bg-yellow-900/90 text-yellow-200 text-center text-sm py-1.5 px-4';
            document.body.prepend(banner);
        }
        banner.textContent = `Connection issues — retrying (${Math.round(currentPollInterval / 1000)}s interval)`;
        banner.style.display = 'block';
    } else if (banner) {
        banner.style.display = 'none';
    }
}

export async function fetchLeaderboard() {
    try {
        const res = await fetch(`${API_URL}?action=getLeaderboard`);
        const result = await res.json();
        if (result.success) state.leaderboard = result.leaderboard || [];
    } catch (e) {}
}

export async function fetchPublicRooms() {
    try {
        const res = await fetch(`${API_URL}?action=listRooms`);
        const result = await res.json();
        if (result.success) { state.publicRooms = result.rooms || []; if (_render) _render(); }
    } catch (e) {}
}

export function startPolling() {
    stopPolling();
    fetchRoom();
    scheduleNextPoll();
}

function scheduleNextPoll() {
    const base = document.hidden ? HIDDEN_TAB_INTERVAL : getAdaptivePollInterval();
    currentPollInterval = base * pollBackoff;
    setPollInterval(setTimeout(() => {
        fetchRoom();
        if (state.roomId) {
            scheduleNextPoll(); // Recursively schedule with updated interval
        }
    }, currentPollInterval));
}

export function stopPolling() {
    if (pollInterval) {
        clearTimeout(pollInterval);
        setPollInterval(null);
    }
    lastRoomHash = null; // Reset change detection on stop
}
