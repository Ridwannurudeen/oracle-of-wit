// Oracle of Wit — API, Polling, Helpers
// Depends on: state.js, effects.js

const API_URL = '/api/game';

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

// esc() and glLogo() moved to render-helpers.js (loaded after api.js)
let currentPollInterval = POLL_INTERVALS.waiting;
let pollBackoff = 1;
let soundEnabled = true;
let audioCtx = null;
let isTyping = false; // Track if user is typing
let typingTimeout = null;

// ETag/change detection — skip render when room data hasn't changed
let lastRoomHash = null;

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
        pollInterval = setTimeout(pollLoop, HIDDEN_TAB_INTERVAL);
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
function setTyping() {
    isTyping = true;
    if (typingTimeout) clearTimeout(typingTimeout);
    // Keep typing flag active for 3 seconds after last keystroke
    typingTimeout = setTimeout(() => { isTyping = false; }, 3000);
}

// Update ONLY the timer display without re-rendering everything
function updateTimerDisplay() {
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
function updateHUDPartials(subCount, playerCount, betCount) {
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
    if (leftWing) leftWing.innerHTML = renderLeftWingContent();
    const rightWing = document.querySelector('[data-hud="right-wing"]');
    if (rightWing) rightWing.innerHTML = renderRightWingContent();
}

// Update character count without re-rendering
function updateCharCount() {
    const charCount = document.getElementById('char-count');
    if (charCount) {
        const len = state.punchlineText.length;
        charCount.textContent = `${len}/200`;
        charCount.className = `text-[10px] font-mono tracking-wider ${len >= 180 ? 'text-red-400 font-bold' : len >= 140 ? 'text-consensus' : 'text-gray-600'}`;
    }
}

// === API CALL WRAPPER ===
async function api(action, data = {}) {
    state.loading = true;
    state.error = null;
    // Don't render during loading if user is typing
    if (!isTyping) render();
    try {
        const res = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, sessionToken })
        });
        const result = await res.json();
        state.loading = false;
        if (!res.ok || result.error) throw new Error(result.error || 'Error');
        return result;
    } catch (e) {
        state.loading = false;
        state.error = e.message;
        render(true); // Force render to show error
        throw e;
    }
}

async function fetchRoom() {
    if (!state.roomId) return;
    try {
        const res = await fetch(`${API_URL}?action=getRoom&roomId=${state.roomId}`);
        const result = await res.json();
        if (!result.success || !result.room) {
            // Room expired on server — auto-recover
            leaveRoom();
            state.error = 'Room expired. Returned to lobby.';
            render(true);
            return;
        }
        pollBackoff = 1; // Reset backoff on success
        updateConnectionBanner();
        if (result.success && result.room) {
            // Change detection — skip render if room data unchanged
            const newHash = simpleHash(result.room);
            if (newHash === lastRoomHash) {
                // Data unchanged — skip render, just update timer
                syncTimer();
                updateTimerDisplay();
                return;
            }
            lastRoomHash = newHash;

            const oldStatus = state.room?.status;
            const oldSubmissionCount = state.room?.submissions?.length || 0;
            const oldBetCount = state.room?.bets?.length || 0;
            const oldPlayerCount = state.room?.players?.length || 0;

            state.room = result.room;
            syncTimer();

            // Render on phase change even when typing
            if (state.room.status !== oldStatus) {
                isTyping = false;
                handlePhaseChange(oldStatus, state.room.status);
                render(true); // Force render on phase change
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
                    render();
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
function updateConnectionBanner() {
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

async function fetchLeaderboard() {
    try {
        const res = await fetch(`${API_URL}?action=getLeaderboard`);
        const result = await res.json();
        if (result.success) state.leaderboard = result.leaderboard || [];
    } catch (e) {}
}

async function fetchPublicRooms() {
    try {
        const res = await fetch(`${API_URL}?action=listRooms`);
        const result = await res.json();
        if (result.success) { state.publicRooms = result.rooms || []; render(); }
    } catch (e) {}
}

function startPolling() {
    stopPolling();
    fetchRoom();
    scheduleNextPoll();
}

function scheduleNextPoll() {
    const base = document.hidden ? HIDDEN_TAB_INTERVAL : getAdaptivePollInterval();
    currentPollInterval = base * pollBackoff;
    pollInterval = setTimeout(() => {
        fetchRoom();
        if (state.roomId) {
            scheduleNextPoll(); // Recursively schedule with updated interval
        }
    }, currentPollInterval);
}

function stopPolling() {
    if (pollInterval) {
        clearTimeout(pollInterval);
        pollInterval = null;
    }
    lastRoomHash = null; // Reset change detection on stop
}
