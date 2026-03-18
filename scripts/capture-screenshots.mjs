/**
 * Screenshot capture script for Oracle of Wit README
 * Uses Playwright to navigate the live app, inject mock game state, and capture screenshots
 *
 * Usage: node scripts/capture-screenshots.mjs [--local]
 *   --local  Use http://localhost:3000 instead of production URL
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'docs', 'images');
const BASE_URL = process.argv.includes('--local')
    ? 'http://localhost:3000'
    : 'https://oracle-of-wit.vercel.app';

mkdirSync(OUT_DIR, { recursive: true });

// ── Mock data ──────────────────────────────────────────────
const MOCK_ROOM = {
    id: 'WIT-7X3K',
    hostName: 'CryptoJester',
    category: 'crypto',
    status: 'submitting',
    currentRound: 2,
    totalRounds: 5,
    jokePrompt: "Why did the smart contract developer break up with their partner?",
    players: [
        { name: 'CryptoJester', score: 250, isBot: false },
        { name: 'PunMaster3000', score: 180, isBot: false },
        { name: 'LOLchain', score: 120, isBot: false },
        { name: 'WittyDegen', score: 90, isBot: false },
    ],
    submissions: [
        { id: 1, playerName: 'CryptoJester', punchline: "Because they kept reverting all their promises!" },
        { id: 2, playerName: 'PunMaster3000', punchline: "They said the relationship had too many gas fees and not enough value." },
        { id: 3, playerName: 'LOLchain', punchline: "Because every time they tried to commit, it was immutable." },
        { id: 4, playerName: 'WittyDegen', punchline: "They found out the relationship was a rug pull from the start." },
    ],
    bets: [
        { playerName: 'CryptoJester', submissionId: 3, amount: 60 },
        { playerName: 'PunMaster3000', submissionId: 1, amount: 40 },
        { playerName: 'LOLchain', submissionId: 3, amount: 80 },
    ],
    betBudgets: { CryptoJester: 240, PunMaster3000: 260, LOLchain: 220, WittyDegen: 300 },
    reactions: [
        { submissionId: 1, emoji: '😂', playerName: 'LOLchain' },
        { submissionId: 1, emoji: '🔥', playerName: 'WittyDegen' },
        { submissionId: 3, emoji: '💀', playerName: 'PunMaster3000' },
        { submissionId: 3, emoji: '😂', playerName: 'CryptoJester' },
        { submissionId: 2, emoji: '👏', playerName: 'LOLchain' },
    ],
    roundResults: [{
        round: 2,
        winnerId: 3,
        winnerName: 'LOLchain',
        winningPunchline: "Because every time they tried to commit, it was immutable.",
        judgingMethod: 'genlayer_optimistic_democracy',
        txHash: '0x7a3f9b2c1d4e5f6a8b9c0d1e2f3a4b5c6d7e8f9a',
        scores: { CryptoJester: 60, PunMaster3000: -40, LOLchain: 100, WittyDegen: 0 },
        aiCommentary: { winnerComment: "The meta-humor of commitment being immutable in both relationships and blockchain is *chef's kiss*. A perfect intersection of tech and feels." },
        streak: 1,
        revealOrder: [2, 4, 1, 3],
    }],
    streaks: { LOLchain: 2 },
    weeklyTheme: { name: 'DeFi Degen', emoji: '💎', description: 'Decentralized roasts only' },
};

const MOCK_LEADERBOARD = [
    { name: 'OracleWhisperer', totalScore: 2450 },
    { name: 'PunMaster3000', totalScore: 1980 },
    { name: 'CryptoJester', totalScore: 1750 },
    { name: 'LOLchain', totalScore: 1520 },
    { name: 'WittyDegen', totalScore: 1340 },
    { name: 'JokeValidator', totalScore: 1100 },
    { name: 'MemeOracle', totalScore: 890 },
    { name: 'BlockBanter', totalScore: 670 },
    { name: 'DeFiJester', totalScore: 450 },
    { name: 'GasGuru', totalScore: 230 },
];

const MOCK_PROFILE = {
    name: 'CryptoJester',
    totalScore: 1750,
    lifetimeXP: 7500,
    gamesPlayed: 42,
    gamesWon: 18,
    roundsWon: 67,
    level: 6,
    title: 'Wit Sage',
    levelName: 'Wit Sage',
    nextLevelXP: 10000,
    achievements: ['first_blood', 'streak_3', 'high_roller'],
    dailyChallengeStreak: 5,
};

// ── Helper: inject state and render ────────────────────────
async function injectAndCapture(page, stateOverrides, filename, opts = {}) {
    const { width = 1400, height = 900 } = opts;
    await page.setViewportSize({ width, height });

    await page.evaluate((overrides) => {
        Object.assign(state, overrides);
        render(true);
    }, stateOverrides);

    // Let animations settle
    await page.waitForTimeout(1500);

    await page.screenshot({
        path: `${OUT_DIR}/${filename}`,
        fullPage: false,
        type: 'png',
    });
    console.log(`  Captured: ${filename}`);
}

// ── Main ───────────────────────────────────────────────────
async function main() {
    console.log(`Launching browser (target: ${BASE_URL})...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        deviceScaleFactor: 2,
        viewport: { width: 1400, height: 900 },
        colorScheme: 'dark',
    });
    const page = await context.newPage();

    console.log('Loading app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait for TailwindCSS & fonts
    await page.waitForTimeout(3000);

    // 1. Welcome screen (hero)
    console.log('\n[1/8] Welcome / Hero...');
    await injectAndCapture(page, {
        screen: 'welcome',
        playerName: '',
    }, 'hero-welcome.png');

    // 2. Lobby overview
    console.log('[2/8] Lobby...');
    await injectAndCapture(page, {
        screen: 'lobby',
        playerName: 'CryptoJester',
        profile: MOCK_PROFILE,
        nextLevelXP: 10000,
        allAchievements: [
            { id: 'first_blood', name: 'First Blood', icon: '🩸' },
            { id: 'streak_3', name: 'Hot Streak', icon: '🔥' },
            { id: 'high_roller', name: 'High Roller', icon: '🎰' },
        ],
        leaderboard: MOCK_LEADERBOARD,
        showHallOfFame: false,
        currentWeeklyTheme: MOCK_ROOM.weeklyTheme,
    }, 'lobby-overview.png');

    // 3. Submit phase
    console.log('[3/8] Submit phase...');
    await injectAndCapture(page, {
        screen: 'submitting',
        playerName: 'CryptoJester',
        room: { ...MOCK_ROOM, status: 'submitting' },
        isHost: true,
        hasSubmitted: false,
        punchlineText: 'Because they kept reverting all their promises!',
        timeLeft: 28,
    }, 'submit-phase.png');

    // 4. Betting phase
    console.log('[4/8] Betting phase...');
    await injectAndCapture(page, {
        screen: 'betting',
        playerName: 'WittyDegen',
        room: { ...MOCK_ROOM, status: 'betting' },
        isHost: false,
        hasBet: false,
        selectedSubmission: 3,
        betAmount: 60,
        timeLeft: 18,
        sentReactions: 0,
    }, 'betting-phase.png');

    // 5. Judging (validators voting)
    console.log('[5/8] Judging / Validators...');
    await injectAndCapture(page, {
        screen: 'judging',
        playerName: 'CryptoJester',
        room: { ...MOCK_ROOM, status: 'judging' },
        validatorVotingStarted: true,
        validatorVotes: [3, 3, 1, 3, 3],
        consensusReached: true,
        winningSubmissionId: 3,
    }, 'judging-validators.png');

    // 6. Reveal (winner)
    console.log('[6/8] Reveal winner...');
    await injectAndCapture(page, {
        screen: 'roundResults',
        revealPhase: 'revealing',
        playerName: 'CryptoJester',
        room: MOCK_ROOM,
        isHost: true,
        revealIndex: 3,
        revealedJokes: [
            { ...MOCK_ROOM.submissions[1], isWinner: false, eliminated: true },
            { ...MOCK_ROOM.submissions[3], isWinner: false, eliminated: true },
            { ...MOCK_ROOM.submissions[0], isWinner: false, eliminated: true },
            { ...MOCK_ROOM.submissions[2], isWinner: true, eliminated: false },
        ],
        validatorVotes: [3, 3, 1, 3, 3],
    }, 'reveal-winner.png');

    // 7. Round results
    console.log('[7/8] Round results...');
    await injectAndCapture(page, {
        screen: 'roundResults',
        revealPhase: null,
        playerName: 'CryptoJester',
        room: MOCK_ROOM,
        isHost: true,
        validatorVotes: [3, 3, 1, 3, 3],
        consensusReached: true,
        appealInProgress: false,
        appealResult: null,
    }, 'round-results.png');

    // 8. Discord bot (simulated) — we'll capture the welcome screen with a Discord-style overlay
    // Since we can't capture actual Discord, we'll use the lobby with Discord-relevant state
    console.log('[8/8] Discord bot (lobby with Discord context)...');
    await injectAndCapture(page, {
        screen: 'lobby',
        playerName: 'CryptoJester',
        profile: MOCK_PROFILE,
        nextLevelXP: 10000,
        allAchievements: [
            { id: 'first_blood', name: 'First Blood', icon: '🩸' },
            { id: 'streak_3', name: 'Hot Streak', icon: '🔥' },
            { id: 'high_roller', name: 'High Roller', icon: '🎰' },
        ],
        leaderboard: MOCK_LEADERBOARD,
        showHallOfFame: false,
        currentWeeklyTheme: MOCK_ROOM.weeklyTheme,
        publicRooms: [
            { id: 'WIT-DC01', status: 'waiting', players: 3, spectators: 2, currentRound: 0, totalRounds: 5 },
            { id: 'WIT-DC02', status: 'submitting', players: 5, spectators: 0, currentRound: 2, totalRounds: 3 },
        ],
    }, 'discord-bot.png', { width: 800, height: 500 });

    // ── GIF capture via video recording ───────────────────
    console.log('\n[GIF 1/2] Gameplay flow recording...');
    const gifCtx = await browser.newContext({
        deviceScaleFactor: 2,
        viewport: { width: 800, height: 500 },
        colorScheme: 'dark',
        recordVideo: { dir: OUT_DIR, size: { width: 800, height: 500 } },
    });
    const gifPage = await gifCtx.newPage();
    await gifPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await gifPage.waitForTimeout(2000);

    // Simulate game flow: submit → bet → judge → results
    const phases = [
        { screen: 'submitting', room: { ...MOCK_ROOM, status: 'submitting' }, hasSubmitted: false, punchlineText: '', timeLeft: 35 },
        { screen: 'submitting', room: { ...MOCK_ROOM, status: 'submitting' }, hasSubmitted: true, timeLeft: 5 },
        { screen: 'betting', room: { ...MOCK_ROOM, status: 'betting' }, hasBet: false, selectedSubmission: null, betAmount: 50, timeLeft: 25 },
        { screen: 'betting', room: { ...MOCK_ROOM, status: 'betting' }, hasBet: false, selectedSubmission: 3, betAmount: 70, timeLeft: 15 },
        { screen: 'judging', room: { ...MOCK_ROOM, status: 'judging' }, validatorVotingStarted: true, validatorVotes: [3], consensusReached: false },
        { screen: 'judging', room: { ...MOCK_ROOM, status: 'judging' }, validatorVotingStarted: true, validatorVotes: [3, 3, 1, 3, 3], consensusReached: true },
        { screen: 'roundResults', revealPhase: null, room: MOCK_ROOM, validatorVotes: [3, 3, 1, 3, 3], consensusReached: true },
    ];

    for (const phase of phases) {
        await gifPage.evaluate((overrides) => {
            Object.assign(state, overrides);
            render(true);
        }, { playerName: 'CryptoJester', isHost: true, ...phase });
        await gifPage.waitForTimeout(1200);
    }

    await gifPage.close();
    await gifCtx.close();
    console.log('  Recorded gameplay-flow video (convert to .gif with ffmpeg)');

    // GIF 2: Oracle eye (we'll capture the welcome screen eye)
    console.log('[GIF 2/2] Oracle eye recording...');
    const eyeCtx = await browser.newContext({
        deviceScaleFactor: 2,
        viewport: { width: 400, height: 400 },
        colorScheme: 'dark',
        recordVideo: { dir: OUT_DIR, size: { width: 400, height: 400 } },
    });
    const eyePage = await eyeCtx.newPage();
    await eyePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await eyePage.waitForTimeout(2000);

    // Simulate mouse tracking over the eye
    for (let i = 0; i < 10; i++) {
        const x = 200 + Math.cos(i * 0.6) * 120;
        const y = 200 + Math.sin(i * 0.6) * 120;
        await eyePage.mouse.move(x, y);
        await eyePage.waitForTimeout(400);
    }

    await eyePage.close();
    await eyeCtx.close();
    console.log('  Recorded oracle-eye video (convert to .gif with ffmpeg)');

    await browser.close();

    console.log('\n=== All captures complete ===');
    console.log(`Output: ${OUT_DIR}`);
    console.log('\nTo convert videos to GIFs:');
    console.log('  ffmpeg -i <video>.webm -vf "fps=12,scale=800:-1" -loop 0 gameplay-flow.gif');
    console.log('  ffmpeg -i <video>.webm -vf "fps=12,scale=400:-1" -loop 0 oracle-eye.gif');
}

main().catch(err => {
    console.error('Capture failed:', err);
    process.exit(1);
});
