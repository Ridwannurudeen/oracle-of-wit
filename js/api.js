// Oracle of Wit — API, Polling, Helpers
// Depends on: state.js, effects.js

const API_URL = '/api/game';
const BASE_POLL_INTERVAL = 1500;

// Prevent XSS from user-supplied content
function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}
// GenLayer logo SVG (from studio.genlayer.com)
function glLogo(size = 16, color = 'currentColor') {
    return `<svg viewBox="0 0 97.76 91.93" width="${size}" height="${size}" fill="${color}" xmlns="http://www.w3.org/2000/svg"><polygon points="44.26 32.35 27.72 67.12 43.29 74.9 0 91.93 44.26 0 44.26 32.35"/><polygon points="53.5 32.35 70.04 67.12 54.47 74.9 97.76 91.93 53.5 0 53.5 32.35"/><polygon points="48.64 43.78 58.33 62.94 48.64 67.69 39.47 62.92 48.64 43.78" opacity="0.3"/></svg>`;
}
let currentPollInterval = BASE_POLL_INTERVAL;
let pollBackoff = 1;
let soundEnabled = true;
let audioCtx = null;
let isTyping = false; // Track if user is typing
let typingTimeout = null;

// Dynamic polling - slower for larger rooms to reduce server load
function getPollInterval() {
    const playerCount = state.room?.players?.length || 0;
    if (playerCount > 50) return 3000;  // 3s for 50+ players
    if (playerCount > 20) return 2500;  // 2.5s for 20-50 players
    if (playerCount > 10) return 2000;  // 2s for 10-20 players
    return BASE_POLL_INTERVAL;          // 1.5s for small rooms
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
    currentPollInterval = getPollInterval() * pollBackoff;
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
}
