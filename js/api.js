// Oracle of Wit — API, Polling, Helpers (ES Module)

import { state, pollInterval, setPollInterval, sessionToken } from './state.js';
import { formatTime } from './render-helpers.js';
import { syncFromLegacyState } from './signals.js';

/** @type {string} Base URL for all API calls. */
export const API_URL = '/api/game';

// Phase-based intervals balance responsiveness vs. server load.
// Judging phase polls fastest (1s) because players are actively waiting for results.
/** @type {Record<string, number>} Phase-based polling intervals in ms. */
const POLL_INTERVALS = {
    lobby: 5000,        // 5s — lobby is low-activity
    waiting: 3000,      // 3s — waiting for players
    submitting: 1500,   // 1.5s — active phase (tightened from 2s)
    betting: 1500,      // 1.5s — active phase (tightened from 2s)
    judging: 1000,      // 1s — want fast updates during judging (tightened from 1.5s)
    voting: 1500,       // 1.5s — active phase (tightened from 2s)
    roundResults: 4000, // 4s — viewing results, low urgency
    finished: 10000,    // 10s — game is over
    idle: 10000,        // 10s — no active game (profile, daily, etc.)
};

// ─── Optimistic UI Guard ────────────────────────────────────────
/** @type {number} Timestamp until which optimistic state should be preserved. */
let optimisticUntil = 0;

/**
 * Set an optimistic guard window. During this window, fetchRoom will
 * preserve local optimistic flags instead of overwriting them with server state.
 * @param {number} ms - Duration of the guard in milliseconds.
 * @returns {void}
 */
export function setOptimisticGuard(ms) {
    optimisticUntil = Date.now() + ms;
}

/**
 * Check if the optimistic guard is currently active.
 * @returns {boolean}
 */
export function isOptimisticActive() {
    return Date.now() < optimisticUntil;
}

/**
 * Clear the optimistic guard immediately.
 * @returns {void}
 */
export function clearOptimisticGuard() {
    optimisticUntil = 0;
}
/** @type {number} Polling interval when tab is hidden (30s). */
const HIDDEN_TAB_INTERVAL = 30000;

/** @type {number} Current effective poll interval in ms. */
let currentPollInterval = POLL_INTERVALS.waiting;
/** @type {number} Exponential backoff multiplier for failed polls. */
let pollBackoff = 1;
/** @type {boolean} Whether sound effects are enabled. */
export let soundEnabled = true;
/** @param {boolean} val */
export function setSoundEnabled(val) { soundEnabled = val; }
/** @type {AudioContext|null} Web Audio API context for sound effects. */
export let audioCtx = null;
/** @param {AudioContext|null} val */
export function setAudioCtx(val) { audioCtx = val; }
/** @type {boolean} Whether the user is currently typing (suppresses re-renders). */
export let isTyping = false;
/** @param {boolean} val */
export function setIsTyping(val) { isTyping = val; }
/** @type {number|null} Timeout handle for the typing debounce. */
export let typingTimeout = null;
/** @param {number|null} val */
export function setTypingTimeout(val) { typingTimeout = val; }

/** @type {number|null} Hash of last fetched room data for change detection. */
let lastRoomHash = null;

// Late-binding references to avoid circular imports
/** @type {((force?: boolean) => void)|null} */ let _render = null;
/** @type {(() => void)|null} */ let _leaveRoom = null;
/** @type {(() => string)|null} */ let _renderLeftWingContent = null;
/** @type {(() => string)|null} */ let _renderRightWingContent = null;
/** @type {((oldStatus: string, newStatus: string) => void)|null} */ let _handlePhaseChange = null;
/** @type {(() => void)|null} */ let _syncTimer = null;

/** @param {(force?: boolean) => void} fn */ export function bindRender(fn) { _render = fn; }
/** @param {() => void} fn */ export function bindLeaveRoom(fn) { _leaveRoom = fn; }
/** @param {() => string} fn */ export function bindRenderLeftWingContent(fn) { _renderLeftWingContent = fn; }
/** @param {() => string} fn */ export function bindRenderRightWingContent(fn) { _renderRightWingContent = fn; }
/** @param {(oldStatus: string, newStatus: string) => void} fn */ export function bindHandlePhaseChange(fn) { _handlePhaseChange = fn; }
/** @param {() => void} fn */ export function bindSyncTimer(fn) { _syncTimer = fn; }

// Fast hash for change detection. Avoids deep-equal on every poll
// by comparing a single 32-bit integer. Collisions are theoretically
// possible but harmless (just causes an extra render).
/**
 * Compute a simple numeric hash of an object for change detection.
 * @param {Object} obj - Object to hash.
 * @returns {number} 32-bit integer hash.
 */
function simpleHash(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

/**
 * Calculate the adaptive polling interval based on game phase and player count.
 * @returns {number} Poll interval in milliseconds.
 */
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

/**
 * Single poll iteration: fetch room data and schedule the next poll.
 * @returns {void}
 */
function pollLoop() {
    fetchRoom();
    if (state.roomId) {
        scheduleNextPoll();
    }
}

/**
 * Mark the user as actively typing. Prevents full re-renders for 3 seconds
 * after the last keystroke.
 * @returns {void}
 */
export function setTyping() {
    isTyping = true;
    if (typingTimeout) clearTimeout(typingTimeout);
    // Keep typing flag active for 3 seconds after last keystroke
    typingTimeout = setTimeout(() => { isTyping = false; }, 3000);
}

/**
 * Update only the timer DOM elements without a full re-render.
 * @returns {void}
 */
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

/**
 * Lightweight DOM patches for HUD counters and wing panels during polls.
 * Avoids full innerHTML rebuild while the user is typing.
 * @param {number} subCount - Current submission count.
 * @param {number} playerCount - Current player count.
 * @param {number} betCount - Current bet count.
 * @returns {void}
 */
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

/**
 * Update the punchline character count display without a full re-render.
 * @returns {void}
 */
export function updateCharCount() {
    const charCount = document.getElementById('char-count');
    if (charCount) {
        const len = state.punchlineText.length;
        charCount.textContent = `${len}/200`;
        charCount.className = `text-[10px] font-mono tracking-wider ${len >= 180 ? 'text-red-400 font-bold' : len >= 140 ? 'text-consensus' : 'text-gray-600'}`;
    }
}

/**
 * Attempt to patch specific DOM elements instead of a full rebuild.
 * Returns true if patching was sufficient, false if a full render is needed.
 * @param {Object} oldRoom - Previous room state (or minimal snapshot).
 * @param {Object} newRoom - New room state.
 * @returns {boolean} Whether patching was sufficient.
 */
export function patchDOM(oldRoom, newRoom) {
    // Full rebuild needed if phase/screen changed
    if (oldRoom.status !== newRoom.status) return false;
    // Full rebuild needed if round changed
    if (oldRoom.currentRound !== newRoom.currentRound) return false;
    // Full rebuild needed if submissions list length changed during submitting (new cards appear)
    if (oldRoom.status === 'submitting' && (oldRoom.submissions?.length ?? 0) !== (newRoom.submissions?.length ?? 0)) return false;
    // Full rebuild needed if round results changed
    if ((oldRoom.roundResults?.length ?? 0) !== (newRoom.roundResults?.length ?? 0)) return false;

    // Track whether main-content-area patches happened (not just sidebars)
    let mainPatched = false;

    // Patch submission counter
    const subCounter = document.querySelector('[data-hud="submitted"]');
    if (subCounter) {
        const humanPlayers = newRoom.players?.filter(p => !p.isBot).length || 0;
        const subCount = newRoom.submissions?.length || 0;
        subCounter.textContent = `${subCount}/${humanPlayers} SUBMITTED`;
        mainPatched = true;
    }

    // Patch bet counter
    const betCounter = document.querySelector('[data-hud="bets"]');
    if (betCounter) {
        const humanPlayers = newRoom.players?.filter(p => !p.isBot).length || 0;
        const betCount = newRoom.bets?.length || 0;
        betCounter.textContent = `${betCount}/${humanPlayers} BET`;
        mainPatched = true;
    }

    // Patch player count in consensus HUD bar
    const hudBar = document.querySelector('.consensus-hud');
    if (hudBar) {
        const playerSpans = hudBar.querySelectorAll('span');
        for (const span of playerSpans) {
            if (span.textContent.match(/^\d+P$/)) {
                span.textContent = `${newRoom.players?.length || 0}P`;
                mainPatched = true;
                break;
            }
        }
    }

    // Patch score display in leaderboard (right wing) — sidebar only
    const rightWing = document.querySelector('[data-hud="right-wing"]');
    if (rightWing && _renderRightWingContent) {
        rightWing.innerHTML = _renderRightWingContent();
    }

    // Patch left wing (activity feed) — sidebar only
    const leftWing = document.querySelector('[data-hud="left-wing"]');
    if (leftWing && _renderLeftWingContent) {
        leftWing.innerHTML = _renderLeftWingContent();
    }

    // Patch vote counts during voting phase
    if (newRoom.status === 'voting') {
        const voteEls = document.querySelectorAll('[data-vote-count]');
        if (voteEls.length > 0) {
            const votes = newRoom.audienceVotes || {};
            const voteCounts = {};
            for (const submissionId of Object.values(votes)) {
                voteCounts[submissionId] = (voteCounts[submissionId] || 0) + 1;
            }
            voteEls.forEach(el => {
                const id = el.dataset.voteCount;
                if (id) el.textContent = voteCounts[id] || 0;
            });
            mainPatched = true;
        }
    }

    // Only return true if main content was patched — wing-only patches
    // should NOT prevent a full render of the main content area
    return mainPatched;
}

/**
 * Generic API call wrapper. Sets loading state, sends JSON POST,
 * triggers immediate poll after mutating actions, and handles errors.
 * @param {string} action - Server action name (e.g. 'submitPunchline').
 * @param {Object} [data={}] - Request body payload.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} On network or server errors.
 */
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

/**
 * Fetch the current room state from the server. Uses hash-based change
 * detection to skip re-renders when data is unchanged.
 * @returns {Promise<void>}
 */
export async function fetchRoom() {
    if (!state.roomId) return;
    try {
        const res = await fetch(`${API_URL}?action=getRoom&roomId=${state.roomId}`);
        if (res.status >= 500) {
            // Server error (e.g. auto-advance timeout) — retry on next poll
            pollBackoff = Math.min(pollBackoff * 2, 8);
            console.warn(`[Poll] server error ${res.status}, will retry`);
            updateConnectionBanner();
            return;
        }
        const result = await res.json();
        if (!result.success || !result.room) {
            // Room genuinely expired or not found (404)
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
                // Data unchanged — skip render, just sync timer
                if (_syncTimer) _syncTimer();
                return;
            }
            lastRoomHash = newHash;

            const oldStatus = state.room?.status;
            const oldSubmissionCount = state.room?.submissions?.length || 0;
            const oldBetCount = state.room?.bets?.length || 0;
            const oldPlayerCount = state.room?.players?.length || 0;

            // Preserve optimistic flags during guard window
            const guardActive = isOptimisticActive();
            const savedHasSubmitted = state.hasSubmitted;
            const savedHasBet = state.hasBet;
            const savedVotedFor = state.votedFor;
            const savedSentReactions = state.sentReactions;

            state.room = result.room;

            if (guardActive) {
                if (savedHasSubmitted) state.hasSubmitted = true;
                if (savedHasBet) state.hasBet = true;
                if (savedVotedFor) state.votedFor = savedVotedFor;
                if (savedSentReactions > 0) state.sentReactions = savedSentReactions;
            }

            // Sync Preact signals AFTER optimistic guard restoration,
            // so islands see the correct guarded values
            syncFromLegacyState(state);
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
                // Waiting/lobby phases need full renders for player list + start button
                const needsFullRender = state.room.status === 'waiting' && newPlayerCount !== oldPlayerCount;

                // During active input phases, do lightweight DOM patches instead of full rebuild
                if (!needsFullRender && (isTyping || document.activeElement?.id === 'punchline')) {
                    updateHUDPartials(newSubmissionCount, newPlayerCount, newBetCount);
                } else if (needsFullRender) {
                    // Force full render so player list and start button update
                    if (_render) _render(true);
                } else {
                    // Try targeted DOM patching first; fall back to full render
                    const oldSnapshot = {
                        status: oldStatus,
                        currentRound: state.room.currentRound,
                        submissions: { length: oldSubmissionCount },
                        bets: { length: oldBetCount },
                        roundResults: state.room.roundResults,
                        players: state.room.players,
                        audienceVotes: state.room.audienceVotes,
                    };
                    if (!patchDOM(oldSnapshot, state.room)) {
                        if (_render) _render();
                    }
                }
            }
        }
    } catch (e) {
        pollBackoff = Math.min(pollBackoff * 2, 8);
        console.warn(`[Poll] fetchRoom failed (backoff=${pollBackoff}x):`, e.message);
        updateConnectionBanner();
    }
}

/**
 * Show or hide the connection degradation warning banner based on backoff state.
 * @returns {void}
 */
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

/**
 * Fetch the global leaderboard and update state.
 * @returns {Promise<void>}
 */
export async function fetchLeaderboard() {
    try {
        const res = await fetch(`${API_URL}?action=getLeaderboard`);
        const result = await res.json();
        if (result.success) state.leaderboard = result.leaderboard || [];
    } catch (_e) { /* silently ignore fetch failures */ }
}

/**
 * Fetch the list of public rooms and update state.
 * @returns {Promise<void>}
 */
export async function fetchPublicRooms() {
    try {
        const res = await fetch(`${API_URL}?action=listRooms`);
        const result = await res.json();
        if (result.success) { state.publicRooms = result.rooms || []; if (_render) _render(); }
    } catch (_e) { /* silently ignore fetch failures */ }
}

/**
 * Start adaptive polling for room updates. Fetches immediately,
 * then schedules subsequent polls at phase-appropriate intervals.
 * @returns {void}
 */
export function startPolling() {
    stopPolling();
    fetchRoom();
    scheduleNextPoll();
}

/**
 * Schedule the next poll with adaptive interval, accounting for
 * tab visibility and backoff multiplier.
 * @returns {void}
 */
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

/**
 * Stop the polling loop and reset change detection.
 * @returns {void}
 */
export function stopPolling() {
    if (pollInterval) {
        clearTimeout(pollInterval);
        setPollInterval(null);
    }
    lastRoomHash = null; // Reset change detection on stop
}
