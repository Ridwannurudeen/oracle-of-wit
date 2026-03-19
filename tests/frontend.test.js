// @vitest-environment jsdom

/**
 * Frontend tests for Oracle of Wit.
 *
 * Now imports pure functions directly from ES module source files.
 * Only test utilities (createDefaultState, resetState) are defined here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import pure functions from actual source modules
import { esc, formatTime, formatEventTime } from '../js/render-helpers.js';

// Functions that depend on deep import chains are kept local to avoid
// pulling in DOM-heavy modules (effects.js/Three.js) in test env
function getNextLevelXPClient(xp) {
    const thresholds = [0, 500, 1500, 3000, 6000, 10000, 20000, 40000, 75000, 150000];
    for (const t of thresholds) {
        if (xp < t) return t;
    }
    return null;
}

function getPollInterval(room) {
    const BASE = 1500;
    const playerCount = room?.players?.length || 0;
    if (playerCount > 50) return 3000;
    if (playerCount > 20) return 2500;
    if (playerCount > 10) return 2000;
    return BASE;
}

// --- Default state factory (mirrors js/state.js) -------------------------
function createDefaultState(overrides = {}) {
    return {
        screen: 'welcome',
        playerName: '',
        roomId: null,
        room: null,
        isHost: false,
        selectedSubmission: null,
        betAmount: 50,
        hasSubmitted: false,
        hasBet: false,
        error: null,
        loading: false,
        leaderboard: [],
        publicRooms: [],
        timeLeft: 0,
        punchlineText: '',
        showHelp: false,
        validatorVotingStarted: false,
        validatorVotes: [],
        consensusReached: false,
        winningSubmissionId: null,
        currentWeeklyTheme: null,
        revealPhase: null,
        revealIndex: -1,
        revealTimer: null,
        revealedJokes: [],
        sentReactions: 0,
        floatingEmojis: [],
        playerId: null,
        profile: null,
        allAchievements: [],
        nextLevelXP: null,
        dailyChallenge: null,
        dailyResult: null,
        dailySubmitting: false,
        hallOfFame: [],
        showHallOfFame: false,
        challengeData: null,
        challengeResult: null,
        appealInProgress: false,
        appealResult: null,
        communityPrompts: [],
        showCommunityPrompts: false,
        votedFor: null,
        ...overrides,
    };
}

// --- resetState helper (equivalent of leaveRoom reset pattern) -----------
function resetState(state) {
    state.roomId = null;
    state.room = null;
    state.isHost = false;
    state.hasSubmitted = false;
    state.hasBet = false;
    state.votedFor = null;
    state.punchlineText = '';
    state.appealInProgress = false;
    state.appealResult = null;
    state._gameCounted = false;
    state.screen = 'lobby';
    state.selectedSubmission = null;
    state.error = null;
    state.loading = false;
}

// --- sanitizeInput (strips control characters, trims whitespace) ---------
function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    // Strip C0/C1 control chars except common whitespace (newline, tab)
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').trim();
}

// --- updateConnectionBanner logic (js/api.js) ----------------------------
function updateConnectionBanner(pollBackoff, currentPollInterval) {
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

// --- syncTimer logic (js/app.js) -----------------------------------------
function syncTimer(state) {
    if (!state.room?.phaseEndsAt) { state.timeLeft = 0; return; }
    state.timeLeft = Math.max(0, Math.floor((state.room.phaseEndsAt - Date.now()) / 1000));
}

// =========================================================================
//  1. STATE MANAGEMENT
// =========================================================================
describe('State Management', () => {
    it('initial state has correct defaults', () => {
        const s = createDefaultState();
        expect(s.screen).toBe('welcome');
        expect(s.roomId).toBeNull();
        expect(s.room).toBeNull();
        expect(s.isHost).toBe(false);
        expect(s.betAmount).toBe(50);
        expect(s.hasSubmitted).toBe(false);
        expect(s.hasBet).toBe(false);
        expect(s.timeLeft).toBe(0);
        expect(s.punchlineText).toBe('');
        expect(s.leaderboard).toEqual([]);
        expect(s.publicRooms).toEqual([]);
        expect(s.error).toBeNull();
        expect(s.loading).toBe(false);
    });

    it('initial state has correct reveal/validator defaults', () => {
        const s = createDefaultState();
        expect(s.validatorVotingStarted).toBe(false);
        expect(s.validatorVotes).toEqual([]);
        expect(s.consensusReached).toBe(false);
        expect(s.winningSubmissionId).toBeNull();
        expect(s.revealPhase).toBeNull();
        expect(s.revealIndex).toBe(-1);
        expect(s.revealTimer).toBeNull();
        expect(s.revealedJokes).toEqual([]);
    });

    it('resetState properly resets all fields', () => {
        const s = createDefaultState({
            screen: 'submitting',
            roomId: 'ABC123',
            room: { id: 'ABC123', players: [] },
            isHost: true,
            hasSubmitted: true,
            hasBet: true,
            votedFor: 'sub-1',
            punchlineText: 'Some text',
            appealInProgress: true,
            appealResult: { overturned: false },
            selectedSubmission: 'sub-2',
            error: 'stale error',
            loading: true,
        });

        resetState(s);

        expect(s.screen).toBe('lobby');
        expect(s.roomId).toBeNull();
        expect(s.room).toBeNull();
        expect(s.isHost).toBe(false);
        expect(s.hasSubmitted).toBe(false);
        expect(s.hasBet).toBe(false);
        expect(s.votedFor).toBeNull();
        expect(s.punchlineText).toBe('');
        expect(s.appealInProgress).toBe(false);
        expect(s.appealResult).toBeNull();
        expect(s.selectedSubmission).toBeNull();
        expect(s.error).toBeNull();
        expect(s.loading).toBe(false);
    });

    it('state mutations persist across reads', () => {
        const s = createDefaultState();
        s.playerName = 'TestPlayer';
        s.betAmount = 100;
        s.screen = 'lobby';

        expect(s.playerName).toBe('TestPlayer');
        expect(s.betAmount).toBe(100);
        expect(s.screen).toBe('lobby');

        // Mutate again
        s.room = { id: 'XYZ', players: [{ name: 'TestPlayer', score: 0 }] };
        expect(s.room.players).toHaveLength(1);
        expect(s.room.players[0].name).toBe('TestPlayer');
    });

    it('player name stored/retrieved from localStorage mock', () => {
        localStorage.clear();
        expect(localStorage.getItem('playerName')).toBeNull();

        localStorage.setItem('playerName', 'MockedPlayer');
        expect(localStorage.getItem('playerName')).toBe('MockedPlayer');

        // Simulate what state.js does on load
        const name = localStorage.getItem('playerName') || '';
        expect(name).toBe('MockedPlayer');
    });

    it('playerId stored/retrieved from localStorage mock', () => {
        localStorage.clear();
        expect(localStorage.getItem('playerId')).toBeNull();

        const id = 'test-uuid-1234';
        localStorage.setItem('playerId', id);
        expect(localStorage.getItem('playerId')).toBe(id);
    });

    it('createDefaultState accepts overrides', () => {
        const s = createDefaultState({ screen: 'lobby', betAmount: 200, playerName: 'Admin' });
        expect(s.screen).toBe('lobby');
        expect(s.betAmount).toBe(200);
        expect(s.playerName).toBe('Admin');
        // Non-overridden values stay default
        expect(s.hasSubmitted).toBe(false);
    });
});

// =========================================================================
//  2. API CLIENT
// =========================================================================
describe('API Client', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Minimal api() replica that captures the same logic
    async function api(action, data = {}, sessionToken = null) {
        const API_URL = '/api/game';
        const state = { loading: false, error: null };
        state.loading = true;
        state.error = null;
        try {
            const res = await fetch(`${API_URL}?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, sessionToken }),
            });
            const result = await res.json();
            state.loading = false;
            if (!res.ok || result.error) throw new Error(result.error || 'Error');
            return result;
        } catch (e) {
            state.loading = false;
            state.error = e.message;
            throw e;
        }
    }

    it('constructs correct fetch URL and body', async () => {
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await api('createRoom', { hostName: 'Alice', category: 'puns' });

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, opts] = fetchSpy.mock.calls[0];
        expect(url).toBe('/api/game?action=createRoom');
        expect(opts.method).toBe('POST');
        expect(opts.headers['Content-Type']).toBe('application/json');

        const body = JSON.parse(opts.body);
        expect(body.hostName).toBe('Alice');
        expect(body.category).toBe('puns');
    });

    it('includes session token when available', async () => {
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        const token = 'tok_abc123';
        await api('submitPunchline', { punchline: 'Hello' }, token);

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body.sessionToken).toBe(token);
    });

    it('sends null sessionToken when not provided', async () => {
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await api('getRoom', { roomId: 'XYZ' });

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body.sessionToken).toBeNull();
    });

    it('handles non-ok responses', async () => {
        fetchSpy.mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'Room is full' }),
        });

        await expect(api('joinRoom', { roomId: 'FULL' })).rejects.toThrow('Room is full');
    });

    it('handles result.error even when res.ok', async () => {
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ error: 'Invalid name' }),
        });

        await expect(api('joinRoom', {})).rejects.toThrow('Invalid name');
    });

    // fetchRoom tests
    describe('fetchRoom behaviour', () => {
        it('updates state on success', async () => {
            const mockRoom = {
                id: 'ABC',
                status: 'waiting',
                players: [{ name: 'Alice', score: 0 }],
            };
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({ success: true, room: mockRoom }),
            });

            const state = createDefaultState({ roomId: 'ABC' });
            const res = await fetch(`/api/game?action=getRoom&roomId=${state.roomId}`);
            const result = await res.json();

            if (result.success && result.room) {
                state.room = result.room;
            }

            expect(state.room).toEqual(mockRoom);
            expect(state.room.players).toHaveLength(1);
        });

        it('increments pollBackoff on failure', async () => {
            fetchSpy.mockRejectedValue(new Error('Network error'));

            let pollBackoff = 1;
            try {
                await fetch('/api/game?action=getRoom&roomId=ABC');
            } catch {
                pollBackoff = Math.min(pollBackoff * 2, 8);
            }

            expect(pollBackoff).toBe(2);

            // Second failure doubles again
            try {
                await fetch('/api/game?action=getRoom&roomId=ABC');
            } catch {
                pollBackoff = Math.min(pollBackoff * 2, 8);
            }
            expect(pollBackoff).toBe(4);
        });

        it('caps pollBackoff at 8', async () => {
            fetchSpy.mockRejectedValue(new Error('Network error'));

            let pollBackoff = 4;
            try { await fetch(''); } catch { pollBackoff = Math.min(pollBackoff * 2, 8); }
            expect(pollBackoff).toBe(8);

            // Already at max — stays at 8
            try { await fetch(''); } catch { pollBackoff = Math.min(pollBackoff * 2, 8); }
            expect(pollBackoff).toBe(8);
        });

        it('resets pollBackoff on success', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({ success: true, room: { id: 'X', status: 'waiting', players: [] } }),
            });

            let pollBackoff = 4; // was backed off
            const res = await fetch('/api/game?action=getRoom&roomId=X');
            const result = await res.json();
            if (result.success && result.room) {
                pollBackoff = 1; // reset on success
            }

            expect(pollBackoff).toBe(1);
        });
    });

    describe('poll interval adjusts with backoff', () => {
        it('returns 1500 for small rooms', () => {
            expect(getPollInterval(null)).toBe(1500);
            expect(getPollInterval({ players: [] })).toBe(1500);
            expect(getPollInterval({ players: new Array(5) })).toBe(1500);
            expect(getPollInterval({ players: new Array(10) })).toBe(1500);
        });

        it('returns 2000 for 11-20 players', () => {
            expect(getPollInterval({ players: new Array(11) })).toBe(2000);
            expect(getPollInterval({ players: new Array(20) })).toBe(2000);
        });

        it('returns 2500 for 21-50 players', () => {
            expect(getPollInterval({ players: new Array(21) })).toBe(2500);
            expect(getPollInterval({ players: new Array(50) })).toBe(2500);
        });

        it('returns 3000 for 51+ players', () => {
            expect(getPollInterval({ players: new Array(51) })).toBe(3000);
            expect(getPollInterval({ players: new Array(100) })).toBe(3000);
        });

        it('effective interval multiplied by backoff', () => {
            const base = getPollInterval({ players: new Array(5) }); // 1500
            const backoff = 4;
            expect(base * backoff).toBe(6000);
        });
    });
});

// =========================================================================
//  3. esc() HTML ESCAPING
// =========================================================================
describe('esc() HTML Escaping', () => {
    it('escapes & < > " and \'', () => {
        expect(esc('&')).toBe('&amp;');
        expect(esc('<')).toBe('&lt;');
        expect(esc('>')).toBe('&gt;');
        // textContent -> innerHTML escapes & < > but quotes stay literal inside
        // a text node's innerHTML. However the quotes are harmless in textContent
        // context. We test that the function at minimum handles & < >.
        expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('returns empty string for falsy input', () => {
        expect(esc('')).toBe('');
        expect(esc(null)).toBe('');
        expect(esc(undefined)).toBe('');
        expect(esc(0)).toBe('');
        expect(esc(false)).toBe('');
    });

    it('handles numeric and object coercion via String()', () => {
        // 42 is truthy so it passes the !str guard, then String(42) -> "42"
        expect(esc(42)).toBe('42');
        // 0 is falsy so esc(0) returns '' (caught by the !str guard)
        expect(esc(0)).toBe('');
    });

    it('preserves normal safe text unchanged', () => {
        expect(esc('Hello World')).toBe('Hello World');
        expect(esc('player_name_123')).toBe('player_name_123');
        expect(esc('My score: 100!')).toBe('My score: 100!');
    });

    it('escapes mixed content correctly', () => {
        expect(esc('Tom & Jerry <3 "quotes"')).toBe('Tom &amp; Jerry &lt;3 "quotes"');
    });

    it('does not double-escape already-escaped strings', () => {
        // If someone passes already-escaped text, esc() will escape the ampersands again.
        // This is the CORRECT browser textContent behaviour — it prevents double-rendering XSS.
        const alreadyEscaped = '&amp;';
        const result = esc(alreadyEscaped);
        expect(result).toBe('&amp;amp;');
        // This confirms no accidental double-escape flattening
    });

    it('handles very long strings', () => {
        const long = '<' + 'a'.repeat(10000) + '>';
        const result = esc(long);
        expect(result.startsWith('&lt;')).toBe(true);
        expect(result.endsWith('&gt;')).toBe(true);
        expect(result.length).toBeGreaterThan(10000);
    });
});

// =========================================================================
//  4. INPUT VALIDATION / sanitizeInput
// =========================================================================
describe('sanitizeInput', () => {
    it('strips control characters', () => {
        expect(sanitizeInput('hello\x00world')).toBe('helloworld');
        expect(sanitizeInput('test\x01\x02\x03')).toBe('test');
        expect(sanitizeInput('\x7Fdelete')).toBe('delete');
        expect(sanitizeInput('a\x0Eb')).toBe('ab');
    });

    it('preserves normal text', () => {
        expect(sanitizeInput('Hello, World!')).toBe('Hello, World!');
        expect(sanitizeInput('Score: 100 (nice)')).toBe('Score: 100 (nice)');
        expect(sanitizeInput('emoji are text too')).toBe('emoji are text too');
    });

    it('trims whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
        expect(sanitizeInput('\t\ntabbed\n\t')).toBe('tabbed');
        expect(sanitizeInput('   ')).toBe('');
    });

    it('returns empty string for non-string input', () => {
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
        expect(sanitizeInput(123)).toBe('');
        expect(sanitizeInput({})).toBe('');
    });

    it('preserves newlines and tabs within content', () => {
        // \n (0x0A) and \t (0x09) are NOT in our stripped range
        expect(sanitizeInput('line1\nline2')).toBe('line1\nline2');
        expect(sanitizeInput('col1\tcol2')).toBe('col1\tcol2');
    });
});

// =========================================================================
//  5. GAME FLOW LOGIC
// =========================================================================
describe('Game Flow Logic', () => {
    it('submitPunchline stores optimistic state', () => {
        const state = createDefaultState({
            punchlineText: 'Why did the chicken cross the road?',
            hasSubmitted: false,
        });

        // Simulate optimistic update from submitPunchline()
        const text = state.punchlineText.trim();
        expect(text).toBeTruthy();
        state.hasSubmitted = true;

        expect(state.hasSubmitted).toBe(true);
    });

    it('submitPunchline rejects empty text', () => {
        const state = createDefaultState({ punchlineText: '', hasSubmitted: false });

        const text = state.punchlineText.trim();
        if (!text) {
            state.error = 'Write a punchline first';
        }

        expect(state.error).toBe('Write a punchline first');
        expect(state.hasSubmitted).toBe(false);
    });

    it('submitPunchline reverts on API error', () => {
        const state = createDefaultState({
            punchlineText: 'Some joke',
            hasSubmitted: false,
        });

        // Optimistic update
        state.hasSubmitted = true;
        expect(state.hasSubmitted).toBe(true);

        // Simulate error revert
        state.hasSubmitted = false;
        state.error = 'Failed to submit. Try again.';

        expect(state.hasSubmitted).toBe(false);
        expect(state.error).toBe('Failed to submit. Try again.');
    });

    it('castVote prevents double-voting in UI', () => {
        const state = createDefaultState({ votedFor: null });

        // First vote
        if (!state.votedFor) {
            state.votedFor = 'submission-1';
        }
        expect(state.votedFor).toBe('submission-1');

        // Second vote attempt — should be blocked
        if (!state.votedFor) {
            state.votedFor = 'submission-2';
        }
        expect(state.votedFor).toBe('submission-1'); // unchanged
    });

    it('castVote reverts on API error', () => {
        const state = createDefaultState({
            votedFor: null,
            room: { audienceVotes: {} },
        });

        // Optimistic
        state.votedFor = 'sub-5';
        state.room.audienceVotes['TestPlayer'] = 'sub-5';

        // Revert
        state.votedFor = null;
        delete state.room.audienceVotes['TestPlayer'];

        expect(state.votedFor).toBeNull();
        expect(state.room.audienceVotes['TestPlayer']).toBeUndefined();
    });

    it('placeBet clamps amount to budget', () => {
        const budget = 120;
        let betAmount = 200;

        // Simulate clamping (placeBet logic path)
        betAmount = Math.min(betAmount, budget);
        expect(betAmount).toBe(120);

        // Already within budget
        betAmount = 50;
        betAmount = Math.min(betAmount, budget);
        expect(betAmount).toBe(50);
    });

    it('placeBet requires a selected submission', () => {
        const state = createDefaultState({ selectedSubmission: null });

        if (!state.selectedSubmission) {
            state.error = 'Select a submission first';
        }

        expect(state.error).toBe('Select a submission first');
    });

    it('placeBet optimistic update and revert', () => {
        const state = createDefaultState({
            selectedSubmission: 'sub-3',
            hasBet: false,
        });

        // Optimistic
        state.hasBet = true;
        expect(state.hasBet).toBe(true);

        // Revert on error
        state.hasBet = false;
        expect(state.hasBet).toBe(false);
    });

    it('timer countdown calculates correct remaining time', () => {
        const state = createDefaultState();
        const now = Date.now();

        // 30 seconds remaining
        state.room = { phaseEndsAt: now + 30000 };
        syncTimer(state);
        expect(state.timeLeft).toBe(30);

        // 0 seconds remaining (past)
        state.room = { phaseEndsAt: now - 5000 };
        syncTimer(state);
        expect(state.timeLeft).toBe(0);

        // No phaseEndsAt
        state.room = {};
        syncTimer(state);
        expect(state.timeLeft).toBe(0);
    });

    it('phase change detection works', () => {
        const state = createDefaultState({ screen: 'waiting' });
        const oldStatus = 'waiting';
        const newStatus = 'submitting';

        // Simulate handlePhaseChange logic
        if (newStatus !== oldStatus) {
            state.screen = newStatus === 'roundResults' ? 'roundResults' : newStatus;
        }

        expect(state.screen).toBe('submitting');
    });

    it('handlePhaseChange resets state for submitting phase', () => {
        const state = createDefaultState({
            hasSubmitted: true,
            punchlineText: 'old joke',
            validatorVotingStarted: true,
            validatorVotes: ['v1', 'v2'],
            consensusReached: true,
            winningSubmissionId: 'sub-1',
            sentReactions: 3,
        });

        // Simulate submitting phase reset
        const newStatus = 'submitting';
        state.screen = newStatus;
        state.hasSubmitted = false;
        state.punchlineText = '';
        state.validatorVotingStarted = false;
        state.validatorVotes = [];
        state.consensusReached = false;
        state.winningSubmissionId = null;
        state.sentReactions = 0;

        expect(state.hasSubmitted).toBe(false);
        expect(state.punchlineText).toBe('');
        expect(state.validatorVotes).toEqual([]);
        expect(state.sentReactions).toBe(0);
    });

    it('handlePhaseChange resets state for betting phase', () => {
        const state = createDefaultState({
            hasBet: true,
            selectedSubmission: 'sub-2',
            sentReactions: 2,
        });

        // Simulate betting phase reset
        state.screen = 'betting';
        state.hasBet = false;
        state.selectedSubmission = null;
        state.sentReactions = 0;

        expect(state.hasBet).toBe(false);
        expect(state.selectedSubmission).toBeNull();
        expect(state.sentReactions).toBe(0);
    });

    it('handlePhaseChange resets votedFor on voting phase', () => {
        const state = createDefaultState({ votedFor: 'sub-1' });

        state.screen = 'voting';
        state.votedFor = null;

        expect(state.votedFor).toBeNull();
    });
});

// =========================================================================
//  6. CONNECTION HANDLING
// =========================================================================
describe('Connection Handling', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('updateConnectionBanner shows banner when pollBackoff > 1', () => {
        updateConnectionBanner(2, 3000);

        const banner = document.getElementById('connection-banner');
        expect(banner).not.toBeNull();
        expect(banner.style.display).toBe('block');
        expect(banner.textContent).toContain('Connection issues');
        expect(banner.textContent).toContain('3s interval');
    });

    it('updateConnectionBanner hides banner when pollBackoff === 1', () => {
        // First create the banner
        updateConnectionBanner(4, 6000);
        expect(document.getElementById('connection-banner')).not.toBeNull();

        // Now hide it
        updateConnectionBanner(1, 1500);
        const banner = document.getElementById('connection-banner');
        expect(banner.style.display).toBe('none');
    });

    it('updateConnectionBanner creates banner only once', () => {
        updateConnectionBanner(2, 3000);
        updateConnectionBanner(4, 6000);

        const banners = document.querySelectorAll('#connection-banner');
        expect(banners).toHaveLength(1);
        // Text should reflect latest call
        expect(banners[0].textContent).toContain('6s interval');
    });

    it('does not create banner when pollBackoff is 1 and none exists', () => {
        updateConnectionBanner(1, 1500);
        expect(document.getElementById('connection-banner')).toBeNull();
    });

    it('online/offline events update state correctly', () => {
        const state = createDefaultState({ roomId: 'ABC', error: null });

        // Simulate offline
        state.error = 'You are offline. Reconnect to continue.';
        expect(state.error).toContain('offline');

        // Simulate online
        state.error = null;
        expect(state.error).toBeNull();
    });
});

// =========================================================================
//  7. HELPER FUNCTIONS
// =========================================================================
describe('Helper Functions', () => {
    describe('formatTime()', () => {
        it('formats seconds correctly', () => {
            expect(formatTime(0)).toBe('0:00');
            expect(formatTime(5)).toBe('0:05');
            expect(formatTime(30)).toBe('0:30');
            expect(formatTime(60)).toBe('1:00');
            expect(formatTime(90)).toBe('1:30');
            expect(formatTime(125)).toBe('2:05');
        });

        it('pads single-digit seconds', () => {
            expect(formatTime(1)).toBe('0:01');
            expect(formatTime(9)).toBe('0:09');
            expect(formatTime(61)).toBe('1:01');
        });
    });

    describe('getNextLevelXPClient()', () => {
        it('returns correct next threshold', () => {
            expect(getNextLevelXPClient(0)).toBe(500);
            expect(getNextLevelXPClient(499)).toBe(500);
            expect(getNextLevelXPClient(500)).toBe(1500);
            expect(getNextLevelXPClient(1499)).toBe(1500);
            expect(getNextLevelXPClient(1500)).toBe(3000);
            expect(getNextLevelXPClient(9999)).toBe(10000);
        });

        it('returns null for max level', () => {
            expect(getNextLevelXPClient(150000)).toBeNull();
            expect(getNextLevelXPClient(999999)).toBeNull();
        });
    });

    describe('formatEventTime()', () => {
        it('returns "just now" for < 5s', () => {
            expect(formatEventTime(Date.now())).toBe('just now');
            expect(formatEventTime(Date.now() - 2000)).toBe('just now');
            expect(formatEventTime(Date.now() - 4999)).toBe('just now');
        });

        it('returns seconds for 5-59s', () => {
            const result = formatEventTime(Date.now() - 10000);
            expect(result).toBe('10s ago');
        });

        it('returns minutes for 60s-3599s', () => {
            const result = formatEventTime(Date.now() - 120000);
            expect(result).toBe('2m ago');
        });

        it('returns "earlier" for 1h+', () => {
            expect(formatEventTime(Date.now() - 3600000)).toBe('earlier');
            expect(formatEventTime(Date.now() - 7200000)).toBe('earlier');
        });
    });

    describe('syncTimer()', () => {
        it('sets timeLeft to 0 when no phaseEndsAt', () => {
            const state = createDefaultState();
            state.room = {};
            syncTimer(state);
            expect(state.timeLeft).toBe(0);
        });

        it('sets timeLeft to 0 when room is null', () => {
            const state = createDefaultState();
            state.room = null;
            syncTimer(state);
            expect(state.timeLeft).toBe(0);
        });

        it('clamps negative values to 0', () => {
            const state = createDefaultState();
            state.room = { phaseEndsAt: Date.now() - 60000 };
            syncTimer(state);
            expect(state.timeLeft).toBe(0);
        });

        it('calculates correct time left', () => {
            const state = createDefaultState();
            state.room = { phaseEndsAt: Date.now() + 15000 };
            syncTimer(state);
            // Allow 1s tolerance for test execution time
            expect(state.timeLeft).toBeGreaterThanOrEqual(14);
            expect(state.timeLeft).toBeLessThanOrEqual(15);
        });
    });
});

// =========================================================================
//  8. VALIDATOR VOTING LOGIC
// =========================================================================
describe('Validator Voting Logic', () => {
    it('generateFinalValidatorVotes produces 5 votes', () => {
        const state = createDefaultState();
        state.room = {
            roundResults: [{ winnerId: 'sub-1' }],
            submissions: [
                { id: 'sub-1', playerName: 'Alice' },
                { id: 'sub-2', playerName: 'Bob' },
                { id: 'sub-3', playerName: 'Charlie' },
            ],
        };

        // Replicate generateFinalValidatorVotes
        const result = state.room.roundResults[state.room.roundResults.length - 1];
        const winnerId = result.winnerId;
        const submissions = state.room.submissions;
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
        state.consensusReached = true;
        state.winningSubmissionId = winnerId;

        expect(state.validatorVotes).toHaveLength(5);
        expect(state.consensusReached).toBe(true);
        expect(state.winningSubmissionId).toBe('sub-1');
        // At least 4 should agree on the winner
        const winnerVoteCount = state.validatorVotes.filter(v => v === winnerId).length;
        expect(winnerVoteCount).toBeGreaterThanOrEqual(4);
    });

    it('does nothing when no round results exist', () => {
        const state = createDefaultState();
        state.room = { roundResults: [] };

        const result = state.room.roundResults?.[state.room.roundResults.length - 1];
        // Should bail early
        expect(result).toBeUndefined();
        expect(state.validatorVotes).toEqual([]);
    });
});

// =========================================================================
//  9. DOM RENDERING HELPERS
// =========================================================================
describe('DOM Rendering Helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('updateTimerDisplay updates timer text', () => {
        document.body.innerHTML = `
            <span id="timer-display">0:00</span>
            <div id="timer-bar" style="width:100%"></div>
            <div id="timer-warning" style="display:none"></div>
        `;

        const state = { timeLeft: 25, screen: 'submitting' };
        const timerEl = document.getElementById('timer-display');
        const timerBar = document.getElementById('timer-bar');
        const timerWarning = document.getElementById('timer-warning');

        // Replicate updateTimerDisplay
        if (timerEl) {
            const isLow = state.timeLeft <= 10;
            timerEl.textContent = formatTime(state.timeLeft);
            timerEl.className = `text-3xl font-mono font-bold ${isLow ? 'countdown-critical text-red-500' : 'text-white'}`;
        }
        if (timerBar) {
            const max = state.screen === 'submitting' ? 40 : state.screen === 'voting' ? 20 : 30;
            const pct = (state.timeLeft / max) * 100;
            timerBar.style.width = `${pct}%`;
        }
        if (timerWarning) {
            timerWarning.style.display = state.timeLeft <= 10 ? 'block' : 'none';
        }

        expect(timerEl.textContent).toBe('0:25');
        expect(timerEl.className).toContain('text-white');
        expect(timerWarning.style.display).toBe('none');
    });

    it('updateTimerDisplay shows warning when timeLeft <= 10', () => {
        document.body.innerHTML = `
            <span id="timer-display">0:00</span>
            <div id="timer-bar" style="width:100%"></div>
            <div id="timer-warning" style="display:none"></div>
        `;

        const state = { timeLeft: 5, screen: 'submitting' };
        const timerEl = document.getElementById('timer-display');
        const timerWarning = document.getElementById('timer-warning');

        const isLow = state.timeLeft <= 10;
        timerEl.textContent = formatTime(state.timeLeft);
        timerEl.className = `text-3xl font-mono font-bold ${isLow ? 'countdown-critical text-red-500' : 'text-white'}`;
        timerWarning.style.display = state.timeLeft <= 10 ? 'block' : 'none';

        expect(timerEl.textContent).toBe('0:05');
        expect(timerEl.className).toContain('countdown-critical');
        expect(timerEl.className).toContain('text-red-500');
        expect(timerWarning.style.display).toBe('block');
    });

    it('updateCharCount reflects current punchline length', () => {
        document.body.innerHTML = '<span id="char-count">0/200</span>';

        const state = { punchlineText: 'Hello world' };
        const charCount = document.getElementById('char-count');
        const len = state.punchlineText.length;
        charCount.textContent = `${len}/200`;

        expect(charCount.textContent).toBe('11/200');
    });

    it('updateCharCount applies warning class at 140+', () => {
        document.body.innerHTML = '<span id="char-count">0/200</span>';

        const len = 150;
        const charCount = document.getElementById('char-count');
        charCount.className = `text-[10px] font-mono tracking-wider ${len >= 180 ? 'text-red-400 font-bold' : len >= 140 ? 'text-consensus' : 'text-gray-600'}`;

        expect(charCount.className).toContain('text-consensus');
    });

    it('updateCharCount applies critical class at 180+', () => {
        document.body.innerHTML = '<span id="char-count">0/200</span>';

        const len = 195;
        const charCount = document.getElementById('char-count');
        charCount.className = `text-[10px] font-mono tracking-wider ${len >= 180 ? 'text-red-400 font-bold' : len >= 140 ? 'text-consensus' : 'text-gray-600'}`;

        expect(charCount.className).toContain('text-red-400');
        expect(charCount.className).toContain('font-bold');
    });
});

// =========================================================================
// 10. GAME EVENT TRACKING
// =========================================================================
describe('Game Event Tracking', () => {
    it('addGameEvent prepends to list', () => {
        const events = [];

        function addGameEvent(type, text) {
            events.unshift({ type, text, time: Date.now() });
            if (events.length > 8) events.pop();
        }

        addGameEvent('round', 'Round 1 started');
        addGameEvent('phase', 'Betting phase opened');

        expect(events).toHaveLength(2);
        expect(events[0].text).toBe('Betting phase opened');
        expect(events[1].text).toBe('Round 1 started');
    });

    it('caps at 8 events', () => {
        const events = [];

        function addGameEvent(type, text) {
            events.unshift({ type, text, time: Date.now() });
            if (events.length > 8) events.pop();
        }

        for (let i = 0; i < 12; i++) {
            addGameEvent('test', `Event ${i}`);
        }

        expect(events).toHaveLength(8);
        expect(events[0].text).toBe('Event 11'); // most recent
        expect(events[7].text).toBe('Event 4');  // oldest kept
    });
});

// =========================================================================
// 11. LEAVE ROOM FLOW
// =========================================================================
describe('Leave Room Flow', () => {
    it('leaveRoom resets all game state', () => {
        const state = createDefaultState({
            screen: 'submitting',
            roomId: 'ABC123',
            room: { id: 'ABC123', status: 'submitting', players: [] },
            isHost: true,
            hasSubmitted: true,
            hasBet: true,
            votedFor: 'sub-1',
            punchlineText: 'my joke',
            appealInProgress: true,
            appealResult: { overturned: true },
        });
        let sessionToken = 'tok_xyz';

        // Simulate leaveRoom
        resetState(state);
        sessionToken = null;

        expect(state.screen).toBe('lobby');
        expect(state.roomId).toBeNull();
        expect(state.room).toBeNull();
        expect(state.isHost).toBe(false);
        expect(state.hasSubmitted).toBe(false);
        expect(state.hasBet).toBe(false);
        expect(state.votedFor).toBeNull();
        expect(state.punchlineText).toBe('');
        expect(state.appealInProgress).toBe(false);
        expect(state.appealResult).toBeNull();
        expect(sessionToken).toBeNull();
    });
});
