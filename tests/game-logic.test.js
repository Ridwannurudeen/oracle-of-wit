/**
 * Unit tests for api/_lib/game-logic.js
 *
 * Mocks: redis, ai, genlayer, logger, constants (partially)
 * Pattern: vi.mock() at top level (hoisted), helper factories for room/submission objects
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock is hoisted above imports automatically
// ---------------------------------------------------------------------------

vi.mock('../api/_lib/redis.js', () => ({
    redisGet: vi.fn(async () => []),
    redisSet: vi.fn(async () => true),
    redisSetNX: vi.fn(async () => true),
    redisDel: vi.fn(async () => true),
}));

vi.mock('../api/_lib/genlayer.js', () => ({
    submitToGenLayer: vi.fn(async () => null),
    pollGenLayerResult: vi.fn(async () => null),
    registerRoundOnChain: vi.fn(async () => null),
    recordResultOnChain: vi.fn(async () => null),
}));

vi.mock('../api/_lib/logger.js', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------

import {
    transitionFromSubmitting,
    autoJudge,
    createRoundResult,
    checkAutoAdvance,
    addBotSubmissions,
    addBotBets,
    getPromptsForCategory,
    pickWinnerRandom,
} from '../api/_lib/game-logic.js';

import { redisGet, redisSet } from '../api/_lib/redis.js';
import { submitToGenLayer, pollGenLayerResult } from '../api/_lib/genlayer.js';
import { CATEGORIZED_PROMPTS } from '../api/_lib/constants.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSubmission(id, playerName, punchline) {
    return { id, playerName, punchline, submittedAt: Date.now() };
}

function makeRoom(overrides = {}) {
    return {
        id: 'TEST-ROOM',
        status: 'submitting',
        currentRound: 1,
        category: 'general',
        jokePrompt: 'Why did the chicken cross the road?',
        players: [
            { name: 'Alice', score: 0, isBot: false },
            { name: 'Bob', score: 0, isBot: false },
        ],
        submissions: [
            makeSubmission(1, 'Alice', 'To get to the other side'),
            makeSubmission(2, 'Bob', 'Because it was bored'),
        ],
        bets: [],
        reactions: [],
        roundResults: [],
        streaks: {},
        usedPrompts: [],
        phaseEndsAt: null,
        updatedAt: Date.now(),
        isSinglePlayer: false,
        audienceVotes: {},
        curatedIds: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

// =========================================================================
// 1. transitionFromSubmitting
// =========================================================================
describe('transitionFromSubmitting', () => {
    it('no submissions -> roundResults with skipped result', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ submissions: [] });

        await transitionFromSubmitting(room, setRoom);

        expect(room.status).toBe('roundResults');
        expect(room.roundResults).toHaveLength(1);
        expect(room.roundResults[0].judgingMethod).toBe('skipped');
        expect(room.roundResults[0].winnerId).toBeNull();
    });

    it('under CURATION_THRESHOLD -> betting phase', async () => {
        const setRoom = vi.fn(async () => true);
        // 2 submissions, default threshold is 8
        const room = makeRoom();

        await transitionFromSubmitting(room, setRoom);

        expect(room.status).toBe('betting');
        expect(room.bets).toEqual([]);
        expect(room.reactions).toEqual([]);
        expect(room.phaseEndsAt).toBeGreaterThan(Date.now() - 1000);
        expect(setRoom).toHaveBeenCalledWith(room.id, room);
    });

    it('many submissions still go to betting (no curation)', async () => {
        const setRoom = vi.fn(async () => true);
        const submissions = [];
        const players = [];
        for (let i = 1; i <= 10; i++) {
            submissions.push(makeSubmission(i, `Player${i}`, `Punchline ${i}`));
            players.push({ name: `Player${i}`, score: 0, isBot: false });
        }
        const room = makeRoom({ submissions, players });

        await transitionFromSubmitting(room, setRoom);

        expect(room.status).toBe('betting');
        expect(setRoom).toHaveBeenCalledWith(room.id, room);
    });

    it('single-player mode calls addBotSubmissions', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            isSinglePlayer: true,
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
            ],
            submissions: [makeSubmission(1, 'Alice', 'My joke')],
        });

        await transitionFromSubmitting(room, setRoom);

        // Bot submission should have been added
        expect(room.submissions.length).toBeGreaterThanOrEqual(2);
        expect(room.submissions.some(s => s.playerName === 'WittyBot')).toBe(true);
    });
});

// =========================================================================
// 2. autoJudge (GenLayer-primary architecture)
// =========================================================================
describe('autoJudge', () => {
    it('sets status to judging then creates round result', async () => {
        const statusCaptures = [];
        const setRoom = vi.fn(async (_id, r) => {
            statusCaptures.push(r.status);
            return true;
        });
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0xabc123' });
        pollGenLayerResult.mockResolvedValueOnce({ winnerId: 1, commentary: null });

        const result = await autoJudge(room, setRoom);

        expect(statusCaptures[0]).toBe('judging');
        expect(result.status).toBe('roundResults');
        expect(result.roundResults).toHaveLength(1);
    });

    it('GenLayer success is the DEFAULT happy path', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0xabc123' });
        pollGenLayerResult.mockResolvedValueOnce({ winnerId: 2, commentary: { winnerComment: 'Good one!', roasts: {} } });

        await autoJudge(room, setRoom);

        const rr = room.roundResults[0];
        expect(rr.winnerId).toBe(2);
        expect(rr.winnerName).toBe('Bob');
        expect(rr.judgingMethod).toBe('genlayer_optimistic_democracy');
        expect(rr.glOverride).toBe(true);
        expect(rr.txHash).toBe('0xabc123');
        expect(rr.onChain).toBe(true);
        expect(rr.aiCommentary).toEqual({ winnerComment: 'Good one!', roasts: {} });
    });

    it('GenLayer succeeds with commentary from two-block judging', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0xdef' });
        pollGenLayerResult.mockResolvedValueOnce({ winnerId: 1, commentary: { winnerComment: 'Hilarious!', roasts: { 2: 'Not bad' } } });

        await autoJudge(room, setRoom);

        const rr = room.roundResults[0];
        expect(rr.judgingMethod).toBe('genlayer_optimistic_democracy');
        expect(rr.aiCommentary?.winnerComment).toBe('Hilarious!');
    });

    it('GenLayer fails -> coin flip with genLayerFailed flag', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce(null); // GenLayer submit failed

        await autoJudge(room, setRoom);

        const rr = room.roundResults[0];
        expect(rr.winnerId).toBeTruthy();
        expect(rr.judgingMethod).toBe('coin_flip');
        expect(room.genLayerFailed).toBe(true);
    });

    it('GenLayer returns invalid winnerId -> coin flip', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0xdef456' });
        pollGenLayerResult.mockResolvedValueOnce({ winnerId: 999, commentary: null }); // invalid id

        await autoJudge(room, setRoom);

        const rr = room.roundResults[0];
        expect(rr.judgingMethod).toBe('coin_flip');
        expect(rr.glOverride).toBe(false);
        expect(room.genLayerFailed).toBe(true);
    });

    it('GenLayer poll times out -> coin flip', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0xtimeout' });
        pollGenLayerResult.mockResolvedValueOnce(null); // poll timed out

        await autoJudge(room, setRoom);

        const rr = room.roundResults[0];
        expect(rr.judgingMethod).toBe('coin_flip');
        expect(room.genLayerFailed).toBe(true);
    });

    it('always creates a roundResult and sets status to roundResults', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0x123' });
        pollGenLayerResult.mockResolvedValueOnce({ winnerId: 2, commentary: null });

        const result = await autoJudge(room, setRoom);

        expect(result.roundResults.length).toBeGreaterThanOrEqual(1);
        expect(result.status).toBe('roundResults');
    });
});

// =========================================================================
// 3. createRoundResult
// =========================================================================
describe('createRoundResult', () => {
    it('correct winner gets +100 score', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        const alice = room.players.find(p => p.name === 'Alice');
        expect(alice.score).toBe(100);
        expect(room.roundResults[0].scores['Alice']).toBe(100);
    });

    it('correct bets get 2x payout', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            bets: [{ playerName: 'Bob', submissionId: 1, amount: 50, placedAt: Date.now() }],
        });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        const bob = room.players.find(p => p.name === 'Bob');
        expect(bob.score).toBe(100); // 0 + 50*2
        expect(room.roundResults[0].scores['Bob']).toBe(100);
    });

    it('wrong bets lose bet amount (min 0)', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            bets: [{ playerName: 'Bob', submissionId: 2, amount: 50, placedAt: Date.now() }],
        });

        // Winner is Alice (id=1), Bob bet on id=2 (wrong)
        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        const bob = room.players.find(p => p.name === 'Bob');
        expect(bob.score).toBe(0); // max(0, 0 - 50) = 0
    });

    it('wrong bet does not go below 0', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'Bob', score: 20, isBot: false },
            ],
            bets: [{ playerName: 'Bob', submissionId: 2, amount: 50, placedAt: Date.now() }],
        });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        const bob = room.players.find(p => p.name === 'Bob');
        // max(0, 20 - 50) = 0, not -30
        expect(bob.score).toBe(0);
    });

    it('streak tracking: consecutive wins increment', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [], streaks: { Alice: 1, Bob: 0 } });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        expect(room.streaks['Alice']).toBe(2);
        expect(room.streaks['Bob']).toBe(0);
        expect(room.roundResults[0].streak).toBe(2);
    });

    it('streak tracking: loss resets streak', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [], streaks: { Alice: 3, Bob: 0 } });

        // Bob wins, so Alice's streak should reset
        await createRoundResult(room, 2, Date.now(), 'claude_api', false, null, null, setRoom);

        expect(room.streaks['Alice']).toBe(0);
        expect(room.streaks['Bob']).toBe(1);
    });

    it('comeback detection: last place player wins', async () => {
        const setRoom = vi.fn(async () => true);
        // Alice is ahead (200pts), Bob is behind (0pts). Bob wins -> isComeback
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 200, isBot: false },
                { name: 'Bob', score: 0, isBot: false },
            ],
            bets: [],
        });

        await createRoundResult(room, 2, Date.now(), 'claude_api', false, null, null, setRoom);

        expect(room.roundResults[0].isComeback).toBe(true);
    });

    it('no comeback when winner was not last place', async () => {
        const setRoom = vi.fn(async () => true);
        // Alice is ahead (200pts), Bob is behind (0pts). Alice wins -> not comeback
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 200, isBot: false },
                { name: 'Bob', score: 0, isBot: false },
            ],
            bets: [],
        });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        expect(room.roundResults[0].isComeback).toBe(false);
    });

    it('revealOrder puts winner last', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, null, null, setRoom);

        const order = room.roundResults[0].revealOrder;
        expect(order[order.length - 1]).toBe(1);
        expect(order).toContain(2);
    });

    it('hall of fame updated for non-bot winners via Redis', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });

        await createRoundResult(room, 1, Date.now(), 'claude_api', false, { winnerComment: 'Great!' }, null, setRoom);

        // Hall of fame is now written to Redis (fire-and-forget async)
        // Wait a tick for the fire-and-forget to execute
        await new Promise(r => setTimeout(r, 10));

        expect(redisSet).toHaveBeenCalledWith(
            'hall_of_fame',
            expect.arrayContaining([
                expect.objectContaining({ author: 'Alice' })
            ]),
            expect.any(Number)
        );
    });

    it('hall of fame NOT updated for bot winners', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
            ],
            submissions: [
                makeSubmission(1, 'Alice', 'Joke A'),
                makeSubmission(2, 'WittyBot', 'Bot joke'),
            ],
            bets: [],
        });

        redisSet.mockClear();
        await createRoundResult(room, 2, Date.now(), 'claude_api', false, null, null, setRoom);

        // Wait a tick for any fire-and-forget to execute
        await new Promise(r => setTimeout(r, 10));

        // redisSet should NOT have been called with 'hall_of_fame'
        const hofCalls = redisSet.mock.calls.filter(c => c[0] === 'hall_of_fame');
        expect(hofCalls.length).toBe(0);
    });

    it('invalid winnerId falls back to first submission', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ bets: [] });

        await createRoundResult(room, 999, Date.now(), 'claude_api', false, null, null, setRoom);

        // Should fall back to first submission (Alice, id=1)
        const rr = room.roundResults[0];
        expect(rr.winnerId).toBe(1);
        expect(rr.winnerName).toBe('Alice');
        expect(rr.judgingMethod).toBe('fallback');
    });

    it('no submissions at all -> skipped result', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ submissions: [], bets: [] });

        await createRoundResult(room, 999, Date.now(), 'claude_api', false, null, null, setRoom);

        const rr = room.roundResults[0];
        expect(rr.winnerId).toBeNull();
        expect(rr.judgingMethod).toBe('skipped');
        expect(room.status).toBe('roundResults');
    });
});

// =========================================================================
// 5. checkAutoAdvance
// =========================================================================
describe('checkAutoAdvance', () => {
    it('returns room unchanged if no phaseEndsAt', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({ phaseEndsAt: null });
        const result = await checkAutoAdvance(room, setRoom);

        expect(result).toBe(room);
        expect(setRoom).not.toHaveBeenCalled();
    });

    it('returns room unchanged if phaseEndsAt not yet expired', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            status: 'submitting',
            phaseEndsAt: Date.now() + 60000,
        });

        const result = await checkAutoAdvance(room, setRoom);

        expect(result).toBe(room);
        expect(result.status).toBe('submitting'); // unchanged
    });

    it('submitting phase past deadline -> transitions', async () => {
        const setRoom = vi.fn(async () => true);
        const room = makeRoom({
            status: 'submitting',
            phaseEndsAt: Date.now() - 1000,
        });

        const result = await checkAutoAdvance(room, setRoom);

        // transitionFromSubmitting was called, so status should have changed
        expect(result.status).not.toBe('submitting');
    });

    it('betting phase past deadline -> autoJudge', async () => {
        const setRoom = vi.fn(async () => true);
        submitToGenLayer.mockResolvedValueOnce({ txHash: '0xauto' });
        pollGenLayerResult.mockResolvedValueOnce({ winnerId: 1, commentary: null });
        const room = makeRoom({
            status: 'betting',
            phaseEndsAt: Date.now() - 1000,
            bets: [],
        });

        const result = await checkAutoAdvance(room, setRoom);

        expect(result.status).toBe('roundResults');
        expect(result.roundResults.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null/undefined room as-is', async () => {
        const setRoom = vi.fn(async () => true);
        const result = await checkAutoAdvance(null, setRoom);
        expect(result).toBeNull();
    });
});

// =========================================================================
// 6. addBotSubmissions
// =========================================================================
describe('addBotSubmissions', () => {
    it('adds submissions for all bot players', async () => {
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
                { name: 'JokesMaster', score: 0, isBot: true },
            ],
            submissions: [makeSubmission(1, 'Alice', 'Human joke')],
        });

        await addBotSubmissions(room);

        expect(room.submissions).toHaveLength(3);
        expect(room.submissions.find(s => s.playerName === 'WittyBot')).toBeTruthy();
        expect(room.submissions.find(s => s.playerName === 'JokesMaster')).toBeTruthy();
    });

    it('does not add duplicate submissions for bots that already submitted', async () => {
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
                { name: 'JokesMaster', score: 0, isBot: true },
            ],
            submissions: [
                makeSubmission(1, 'Alice', 'Human joke'),
                makeSubmission(2, 'WittyBot', 'Already submitted'),
            ],
        });

        await addBotSubmissions(room);

        // Only JokesMaster should be added, not WittyBot again
        const wittyBotSubs = room.submissions.filter(s => s.playerName === 'WittyBot');
        expect(wittyBotSubs).toHaveLength(1);
        expect(room.submissions.find(s => s.playerName === 'JokesMaster')).toBeTruthy();
    });

    it('uses hardcoded punchlines from PROMPT_PUNCHLINES or FALLBACK_PUNCHLINES', async () => {
        const room = makeRoom({
            jokePrompt: "Why do programmers prefer dark mode? Because...",
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
            ],
            submissions: [makeSubmission(1, 'Alice', 'My answer')],
        });

        await addBotSubmissions(room);

        expect(room.submissions).toHaveLength(2);
        const botSub = room.submissions.find(s => s.playerName === 'WittyBot');
        expect(botSub).toBeTruthy();
        expect(typeof botSub.punchline).toBe('string');
        expect(botSub.punchline.length).toBeGreaterThan(0);
    });

    it('does nothing when no bots need submissions', async () => {
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'Bob', score: 0, isBot: false },
            ],
            submissions: [
                makeSubmission(1, 'Alice', 'Joke 1'),
                makeSubmission(2, 'Bob', 'Joke 2'),
            ],
        });

        await addBotSubmissions(room);

        expect(room.submissions).toHaveLength(2);
    });
});

// =========================================================================
// 7. addBotBets
// =========================================================================
describe('addBotBets', () => {
    it('bots bet on submissions from other players (not their own)', () => {
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
            ],
            submissions: [
                makeSubmission(1, 'Alice', 'Human joke'),
                makeSubmission(2, 'WittyBot', 'Bot joke'),
            ],
            bets: [],
        });

        addBotBets(room);

        expect(room.bets).toHaveLength(1);
        const botBet = room.bets[0];
        expect(botBet.playerName).toBe('WittyBot');
        // Bot should bet on Alice's submission (id=1), not its own (id=2)
        expect(botBet.submissionId).toBe(1);
        expect(botBet.amount).toBeGreaterThanOrEqual(30);
        expect(botBet.amount).toBeLessThan(80);
    });

    it('does not duplicate bets for bots that already bet', () => {
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
            ],
            submissions: [
                makeSubmission(1, 'Alice', 'Human joke'),
                makeSubmission(2, 'WittyBot', 'Bot joke'),
            ],
            bets: [{ playerName: 'WittyBot', submissionId: 1, amount: 50, placedAt: Date.now() }],
        });

        addBotBets(room);

        const wittyBotBets = room.bets.filter(b => b.playerName === 'WittyBot');
        expect(wittyBotBets).toHaveLength(1);
    });

    it('multiple bots each bet on others submissions', () => {
        const room = makeRoom({
            players: [
                { name: 'Alice', score: 0, isBot: false },
                { name: 'WittyBot', score: 0, isBot: true },
                { name: 'JokesMaster', score: 0, isBot: true },
            ],
            submissions: [
                makeSubmission(1, 'Alice', 'Human joke'),
                makeSubmission(2, 'WittyBot', 'Bot joke 1'),
                makeSubmission(3, 'JokesMaster', 'Bot joke 2'),
            ],
            bets: [],
        });

        addBotBets(room);

        expect(room.bets).toHaveLength(2);
        const wittyBet = room.bets.find(b => b.playerName === 'WittyBot');
        const jokesBet = room.bets.find(b => b.playerName === 'JokesMaster');
        expect(wittyBet).toBeTruthy();
        expect(jokesBet).toBeTruthy();
        // Each bot should NOT bet on their own submission
        expect(wittyBet.submissionId).not.toBe(2);
        expect(jokesBet.submissionId).not.toBe(3);
    });
});

// =========================================================================
// 8. getPromptsForCategory
// =========================================================================
describe('getPromptsForCategory', () => {
    it('returns category-specific prompts for known category', () => {
        const prompts = getPromptsForCategory('tech');
        // Should contain all tech prompts plus some bonus theme prompts
        expect(prompts.length).toBeGreaterThanOrEqual(CATEGORIZED_PROMPTS.tech.length);
        for (const p of CATEGORIZED_PROMPTS.tech) {
            expect(prompts).toContain(p);
        }
    });

    it('includes weekly theme bonus prompts', () => {
        const prompts = getPromptsForCategory('tech');
        // Should have more prompts than just the base category (bonus added)
        expect(prompts.length).toBeGreaterThan(CATEGORIZED_PROMPTS.tech.length);
    });

    it('falls back to general for unknown category', () => {
        const prompts = getPromptsForCategory('nonexistent_category_xyz');
        // Should contain general prompts
        for (const p of CATEGORIZED_PROMPTS.general) {
            expect(prompts).toContain(p);
        }
    });

    it('returns prompts for crypto category', () => {
        const prompts = getPromptsForCategory('crypto');
        expect(prompts.length).toBeGreaterThanOrEqual(CATEGORIZED_PROMPTS.crypto.length);
        for (const p of CATEGORIZED_PROMPTS.crypto) {
            expect(prompts).toContain(p);
        }
    });
});
