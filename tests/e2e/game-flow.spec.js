import { test, expect } from '@playwright/test';

// ── Mock API Helpers ─────────────────────────────────────────────

/**
 * Sets up route interception for all /api/game calls.
 * Returns mock responses based on the action query parameter.
 */
async function mockAPI(page, overrides = {}) {
    await page.route('**/api/game**', async (route) => {
        const url = new URL(route.request().url(), 'http://localhost');
        const action = url.searchParams.get('action');

        const defaults = {
            createRoom: {
                success: true,
                roomId: 'TEST01',
                sessionToken: 'mock-token-123',
                room: mockRoom({ id: 'TEST01', status: 'waiting', isSinglePlayer: false }),
            },
            joinRoom: {
                success: true,
                sessionToken: 'mock-token-456',
                room: mockRoom({ id: 'TEST01', status: 'waiting', isSinglePlayer: false }),
            },
            getRoom: {
                success: true,
                room: mockRoom({ id: 'TEST01', status: 'waiting', isSinglePlayer: false }),
            },
            startGame: {
                success: true,
                room: mockRoom({
                    id: 'TEST01',
                    status: 'submitting',
                    currentRound: 1,
                    jokePrompt: 'Why do programmers prefer dark mode?',
                    phaseEndsAt: Date.now() + 40000,
                }),
            },
            submitPunchline: { success: true },
            listRooms: { success: true, rooms: [] },
            getLeaderboard: { success: true, leaderboard: mockLeaderboard() },
            getWeeklyTheme: { success: false },
            createProfile: {
                success: true,
                profile: mockProfile(),
                nextLevelXP: 1500,
                achievements: mockAchievements(),
            },
            getDailyChallenge: {
                success: true,
                daily: {
                    prompt: 'Why did the blockchain developer break up?',
                    date: '2026-03-19',
                    alreadyPlayed: false,
                    leaderboard: [],
                },
            },
            getPromptSubmissions: {
                success: true,
                prompts: [
                    { id: 'p1', prompt: 'Why do validators always argue?', author: 'CryptoJester', votes: 3, status: 'pending' },
                ],
            },
            getHallOfFame: {
                success: true,
                hallOfFame: [
                    { prompt: 'Why did the AI cross the road?', punchline: 'To optimize the path.', author: 'WitMaster', commentary: 'Efficient humor.' },
                ],
            },
            placeBet: { success: true, remainingBudget: 250 },
            advancePhase: {
                success: true,
                room: mockRoom({ id: 'TEST01', status: 'betting', currentRound: 1 }),
            },
        };

        const response = overrides[action] || defaults[action] || { success: true };

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });
}

function mockRoom(overrides = {}) {
    return {
        id: 'TEST01',
        status: 'waiting',
        host: 'TestPlayer',
        players: [
            { name: 'TestPlayer', score: 0, isHost: true, isBot: false },
            { name: 'BotAlpha', score: 0, isHost: false, isBot: true },
            { name: 'BotBeta', score: 0, isHost: false, isBot: true },
        ],
        category: 'tech',
        currentRound: 0,
        totalRounds: 5,
        submissions: [],
        bets: [],
        isSinglePlayer: false,
        jokePrompt: 'Why do programmers prefer dark mode?',
        phaseEndsAt: Date.now() + 40000,
        betBudgets: { TestPlayer: 300 },
        reactions: [],
        audienceVotes: {},
        ...overrides,
    };
}

function mockProfile() {
    return {
        name: 'TestPlayer',
        level: 3,
        title: 'Jokester',
        lifetimeXP: 1200,
        gamesPlayed: 10,
        gamesWon: 4,
        roundsWon: 12,
        bestStreak: 3,
        totalCorrectBets: 5,
        dailyChallengeStreak: 2,
        achievements: ['first_win'],
    };
}

function mockAchievements() {
    return [
        { id: 'first_win', name: 'First Win', icon: '🏆' },
        { id: 'streak_3', name: 'Streak 3', icon: '🔥' },
        { id: 'bet_master', name: 'Bet Master', icon: '🎰' },
    ];
}

function mockLeaderboard() {
    return [
        { name: 'WitMaster', totalScore: 5200 },
        { name: 'JokeGod', totalScore: 4100 },
        { name: 'PunSlinger', totalScore: 3400 },
        { name: 'TestPlayer', totalScore: 1200 },
    ];
}

/** Navigate to the app and wait for it to be rendered */
async function loadApp(page) {
    // Block external CDN resources that slow down tests or fail in headless.
    // Stub them with no-ops so the app scripts can still execute.
    await page.route('https://cdnjs.cloudflare.com/**', async (route) => {
        // three.js — provide a minimal stub
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: 'window.THREE = { WebGLRenderer: function(){this.setSize=function(){};this.render=function(){};this.domElement=document.createElement("canvas")}, Scene: function(){this.add=function(){}}, PerspectiveCamera: function(){this.position={set:function(){}}}, SphereGeometry: function(){}, MeshBasicMaterial: function(){}, Mesh: function(){this.position={set:function(){}}}, AmbientLight: function(){}, PointLight: function(){this.position={set:function(){}}} };',
        });
    });

    await page.route('https://cdn.tailwindcss.com/**', async (route) => {
        // tailwindcss CDN — stub with a no-op that defines tailwind config
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: 'window.tailwind = { config: {} };',
        });
    });

    await page.route('https://fonts.googleapis.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );
    await page.route('https://api.fontshare.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    );
    await page.route('https://fonts.gstatic.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'font/woff2', body: '' })
    );
    await page.route('https://cdn.fontshare.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'font/woff2', body: '' })
    );

    await page.goto('/', { waitUntil: 'load', timeout: 15000 });

    // The #app div starts empty; render() populates it.
    // Wait until #app has child content (i.e., welcome screen rendered).
    await page.waitForFunction(() => {
        const app = document.getElementById('app');
        return app && app.innerHTML.trim().length > 0;
    }, { timeout: 10000 });
}

// ── 3a. WELCOME SCREEN TESTS ────────────────────────────────────

test.describe('Welcome Screen', () => {
    test('shows welcome screen with Oracle of Wit heading', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const heading = page.locator('h1:has-text("ORACLE OF WIT")');
        await expect(heading).toBeVisible();
    });

    test('shows name input field that accepts text', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await expect(nameInput).toBeVisible();

        await nameInput.fill('MyTestName');
        await expect(nameInput).toHaveValue('MyTestName');
    });

    test('shows Initialize Session button', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const btn = page.locator('[data-action="startBootSequence"]');
        await expect(btn).toBeVisible();
        await expect(btn).toContainText('INITIALIZE SESSION');
    });

    test('entering a name and clicking initialize transitions to lobby', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        // Trigger input event for state binding
        await nameInput.dispatchEvent('input');

        const btn = page.locator('[data-action="startBootSequence"]');
        await btn.click();

        // Boot sequence runs for ~1.6s (4 steps x 400ms), then navigates to lobby
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        const lobbyHeading = page.locator('text=GAME LOBBY');
        await expect(lobbyHeading).toBeVisible();
    });
});

// ── 3b. LOBBY SCREEN TESTS ──────────────────────────────────────

test.describe('Lobby Screen', () => {
    async function goToLobby(page) {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');

        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });
    }

    test('lobby shows game creation options for solo and multiplayer', async ({ page }) => {
        await goToLobby(page);

        const soloHeading = page.locator('text=SOLO MODE');
        await expect(soloHeading).toBeVisible();

        const multiHeading = page.locator('text=MULTIPLAYER');
        await expect(multiHeading).toBeVisible();
    });

    test('solo category buttons are visible', async ({ page }) => {
        await goToLobby(page);

        // Solo category buttons: tech, crypto, general with data-single-player="true"
        const techBtn = page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="true"]');
        await expect(techBtn).toBeVisible();

        const cryptoBtn = page.locator('[data-action="createRoom"][data-category="crypto"][data-single-player="true"]');
        await expect(cryptoBtn).toBeVisible();

        const generalBtn = page.locator('[data-action="createRoom"][data-category="general"][data-single-player="true"]');
        await expect(generalBtn).toBeVisible();
    });

    test('leaderboard section loads with player data', async ({ page }) => {
        await goToLobby(page);

        const leaderboardTab = page.locator('[data-action="showLeaderboardTab"]');
        await expect(leaderboardTab).toBeVisible();

        // Leaderboard entries show up
        await expect(page.locator('text=WitMaster')).toBeVisible();
        await expect(page.locator('text=5200 XP')).toBeVisible();
    });

    test('multiplayer category buttons are visible', async ({ page }) => {
        await goToLobby(page);

        const techBtn = page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="false"]');
        await expect(techBtn).toBeVisible();

        const cryptoBtn = page.locator('[data-action="createRoom"][data-category="crypto"][data-single-player="false"]');
        await expect(cryptoBtn).toBeVisible();
    });

    test('room code input and join button are visible', async ({ page }) => {
        await goToLobby(page);

        const roomCodeInput = page.locator('#room-code');
        await expect(roomCodeInput).toBeVisible();

        const joinBtn = page.locator('[data-action="joinRoomFromInput"]');
        await expect(joinBtn).toBeVisible();
        await expect(joinBtn).toContainText('Join');
    });
});

// ── 3c. SINGLE PLAYER GAME FLOW ─────────────────────────────────

test.describe('Single Player Game Flow', () => {
    test('create a single-player game and see submission phase', async ({ page }) => {
        // Override createRoom for single-player
        await mockAPI(page, {
            createRoom: {
                success: true,
                roomId: 'SOLO01',
                sessionToken: 'mock-solo-token',
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'waiting',
                    isSinglePlayer: true,
                    host: 'TestPlayer',
                }),
            },
            getRoom: {
                success: true,
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'waiting',
                    isSinglePlayer: true,
                    host: 'TestPlayer',
                }),
            },
            startGame: {
                success: true,
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'submitting',
                    currentRound: 1,
                    isSinglePlayer: true,
                    jokePrompt: 'Why do programmers prefer dark mode?',
                    phaseEndsAt: Date.now() + 40000,
                }),
            },
        });
        await loadApp(page);

        // Enter name, go to lobby
        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // Click solo tech category
        await page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="true"]').click();

        // Should see waiting screen with SOLO MODE
        await page.waitForSelector('text=SOLO MODE', { timeout: 3000 });

        // Click start game
        await page.locator('[data-action="startGame"]').click();

        // Should see submission phase with the prompt
        await page.waitForSelector('text=COMPLETE THIS JOKE', { timeout: 3000 });
        await expect(page.locator('text=Why do programmers prefer dark mode?')).toBeVisible();

        // Textarea should be visible
        const textarea = page.locator('#punchline');
        await expect(textarea).toBeVisible();
    });

    test('type a punchline and submit it', async ({ page }) => {
        // Set up mock for the full flow
        await mockAPI(page, {
            createRoom: {
                success: true,
                roomId: 'SOLO01',
                sessionToken: 'mock-solo-token',
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'waiting',
                    isSinglePlayer: true,
                    host: 'TestPlayer',
                }),
            },
            getRoom: {
                success: true,
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'waiting',
                    isSinglePlayer: true,
                    host: 'TestPlayer',
                }),
            },
            startGame: {
                success: true,
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'submitting',
                    currentRound: 1,
                    isSinglePlayer: true,
                    jokePrompt: 'Why do programmers prefer dark mode?',
                    phaseEndsAt: Date.now() + 40000,
                }),
            },
        });
        await loadApp(page);

        // Navigate to lobby
        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // Create solo game
        await page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="true"]').click();
        await page.waitForSelector('text=SOLO MODE', { timeout: 3000 });
        await page.locator('[data-action="startGame"]').click();
        await page.waitForSelector('#punchline', { timeout: 3000 });

        // Type a punchline
        const textarea = page.locator('#punchline');
        await textarea.fill('Because the bugs are afraid of the light!');
        await textarea.dispatchEvent('input');

        // Submit button should be visible
        const submitBtn = page.locator('[data-action="submitPunchline"]');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // After submission, should see SUBMITTED confirmation
        await page.waitForSelector('text=SUBMITTED', { timeout: 3000 });
        await expect(page.locator('text=AWAITING TIMER EXPIRY')).toBeVisible();
    });
});

// ── 3d. ROOM CREATION ────────────────────────────────────────────

test.describe('Room Creation', () => {
    test('create a multiplayer room and see room code', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        // Go to lobby
        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // Create multiplayer room
        await page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="false"]').click();

        // Should see room code
        await page.waitForSelector('text=ROOM CODE', { timeout: 3000 });
        await expect(page.locator('text=TEST01')).toBeVisible();

        // Copy button should be present
        const copyBtn = page.locator('[data-action="copyRoomCode"]');
        await expect(copyBtn).toBeVisible();
    });

    test('waiting screen shows player list', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        await page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="false"]').click();
        await page.waitForSelector('text=ROOM CODE', { timeout: 3000 });

        // Player list visible
        await expect(page.locator('text=TestPlayer')).toBeVisible();
        await expect(page.locator('text=BotAlpha')).toBeVisible();
        await expect(page.locator('text=BotBeta')).toBeVisible();

        // Connected count
        await expect(page.locator('text=CONNECTED')).toBeVisible();
    });
});

// ── 3e. NAVIGATION ──────────────────────────────────────────────

test.describe('Navigation', () => {
    async function goToLobby(page) {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });
    }

    test('profile screen is accessible from lobby', async ({ page }) => {
        await goToLobby(page);

        // Click profile button
        await page.locator('[data-action="goToProfile"]').click();

        // Should see profile screen with statistics
        await page.waitForSelector('text=Statistics', { timeout: 3000 });
        await expect(page.locator('text=Games Played')).toBeVisible();
        await expect(page.locator('text=Games Won')).toBeVisible();
    });

    test('daily challenge screen is accessible', async ({ page }) => {
        await goToLobby(page);

        await page.locator('[data-action="fetchDailyChallenge"]').click();

        await page.waitForSelector('text=DAILY ORACLE', { timeout: 3000 });
        await expect(page.locator('text=Why did the blockchain developer break up?')).toBeVisible();
    });

    test('community prompts screen is accessible', async ({ page }) => {
        await goToLobby(page);

        await page.locator('[data-action="fetchCommunityPrompts"]').click();

        await page.waitForSelector('text=COMMUNITY PROMPTS', { timeout: 3000 });
        await expect(page.locator('text=Why do validators always argue?')).toBeVisible();
    });

    test('back to lobby navigation works from profile', async ({ page }) => {
        await goToLobby(page);

        // Navigate to profile
        await page.locator('[data-action="goToProfile"]').click();
        await page.waitForSelector('text=Statistics', { timeout: 3000 });

        // Navigate back
        await page.locator('[data-action="backToLobby"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 3000 });
        await expect(page.locator('text=GAME LOBBY')).toBeVisible();
    });

    test('back to lobby navigation works from community prompts', async ({ page }) => {
        await goToLobby(page);

        await page.locator('[data-action="fetchCommunityPrompts"]').click();
        await page.waitForSelector('text=COMMUNITY PROMPTS', { timeout: 3000 });

        await page.locator('[data-action="backToLobbyFromCommunity"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 3000 });
        await expect(page.locator('text=GAME LOBBY')).toBeVisible();
    });
});

// ── 3f. INPUT VALIDATION ─────────────────────────────────────────

test.describe('Input Validation', () => {
    test('empty name shows error when initializing session', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        // Make sure name input is empty
        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('');
        await nameInput.dispatchEvent('input');

        // Click initialize
        await page.locator('[data-action="startBootSequence"]').click();

        // Should show error message
        await page.waitForSelector('text=Enter your name', { timeout: 3000 });
    });

    test('punchline character count updates as user types', async ({ page }) => {
        await mockAPI(page, {
            createRoom: {
                success: true,
                roomId: 'SOLO01',
                sessionToken: 'mock-solo-token',
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'waiting',
                    isSinglePlayer: true,
                    host: 'TestPlayer',
                }),
            },
            getRoom: {
                success: true,
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'waiting',
                    isSinglePlayer: true,
                    host: 'TestPlayer',
                }),
            },
            startGame: {
                success: true,
                room: mockRoom({
                    id: 'SOLO01',
                    status: 'submitting',
                    currentRound: 1,
                    isSinglePlayer: true,
                    jokePrompt: 'Test prompt?',
                    phaseEndsAt: Date.now() + 40000,
                }),
            },
        });
        await loadApp(page);

        // Go to lobby
        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // Create game and get to submission
        await page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="true"]').click();
        await page.waitForSelector('[data-action="startGame"]', { timeout: 3000 });
        await page.locator('[data-action="startGame"]').click();
        await page.waitForSelector('#punchline', { timeout: 3000 });

        // Check initial char count
        const charCount = page.locator('#char-count');
        await expect(charCount).toContainText('0/200');

        // Type text and check count updates
        const textarea = page.locator('#punchline');
        await textarea.fill('Hello world');
        await textarea.dispatchEvent('input');

        await expect(charCount).toContainText('11/200');
    });
});

// ── 3g. UI RESPONSIVENESS ────────────────────────────────────────

test.describe('UI Responsiveness', () => {
    test('welcome screen elements are visible on mobile viewport (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await mockAPI(page);
        await loadApp(page);

        // Key elements visible
        await expect(page.locator('h1:has-text("ORACLE OF WIT")')).toBeVisible();
        await expect(page.locator('#player-name-input')).toBeVisible();
        await expect(page.locator('[data-action="startBootSequence"]')).toBeVisible();
    });

    test('welcome screen elements are visible on desktop viewport (1280px)', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await mockAPI(page);
        await loadApp(page);

        await expect(page.locator('h1:has-text("ORACLE OF WIT")')).toBeVisible();
        await expect(page.locator('#player-name-input')).toBeVisible();
        await expect(page.locator('[data-action="startBootSequence"]')).toBeVisible();

        // How It Works cards should be visible on desktop
        await expect(page.locator('text=HOW IT WORKS')).toBeVisible();
        await expect(page.locator('.data-card-wit')).toBeVisible();
    });

    test('lobby category buttons are visible and tappable on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // Solo category buttons visible
        const techBtn = page.locator('[data-action="createRoom"][data-category="tech"][data-single-player="true"]');
        await expect(techBtn).toBeVisible();

        // Check that button is clickable (not obscured)
        await expect(techBtn).toBeEnabled();
    });
});

// ── ADDITIONAL: HEADER & GLOBAL UI ───────────────────────────────

test.describe('Header and Global UI', () => {
    test('header shows Oracle of Wit branding and GenLayer', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // Header should show Oracle of Wit
        const header = page.locator('#main-header');
        await expect(header).toBeVisible();
        await expect(header.locator('text=ORACLE OF WIT')).toBeVisible();
        await expect(header.locator('text=GENLAYER PROTOCOL')).toBeVisible();
    });

    test('sound toggle button is visible and clickable', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        const soundBtn = page.locator('[data-action="toggleSound"]');
        await expect(soundBtn).toBeVisible();

        // Click should not error
        await soundBtn.click();
    });

    test('player name appears in header after login', async ({ page }) => {
        await mockAPI(page);
        await loadApp(page);

        const nameInput = page.locator('#player-name-input');
        await nameInput.fill('TestPlayer');
        await nameInput.dispatchEvent('input');
        await page.locator('[data-action="startBootSequence"]').click();
        await page.waitForSelector('text=GAME LOBBY', { timeout: 5000 });

        // The header should show the player's profile level/title or name
        const header = page.locator('#main-header');
        // Profile mock returns level 3 and title 'Jokester'
        await expect(header.locator('text=Jokester')).toBeVisible();
    });
});
