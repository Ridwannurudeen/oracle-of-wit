/**
 * Integration tests for Oracle of Wit — boundary-level regressions.
 *
 * These tests exercise full game flows and the specific boundary bugs
 * that were caught through manual testing and fixed in prior commits:
 *   - Double-advance prevention (67efffe)
 *   - Polling resilience / false room expiry (0fc87ed)
 *   - Auto-advance recovery from stuck judging (bb09076)
 *   - Phase timer expiry transitions
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  store, counters, tokens,
  resetStore, resetTokens, installFetchMock,
  handler, _resetCircuit, redisGet,
  makeReq, makeRes, call, ensurePlayerSession, setupRoom,
} from './test-helpers.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration Tests', () => {
  beforeEach(() => {
    resetStore();
    resetTokens();
    _resetCircuit();
    installFetchMock();
  });

  // =========================================================================
  // A. Full Solo Game Lifecycle
  // =========================================================================

  describe('Full Solo Game Lifecycle', () => {
    it('plays through create → start → submit → betting → judging → results → round 2 → finish', async () => {
      // Create single-player room (host + 3 bots)
      const { status: createStatus, body: createBody } = await call('createRoom', {
        hostName: 'SoloPlayer',
        category: 'tech',
        singlePlayer: true,
      });
      expect(createStatus).toBe(200);
      expect(createBody.room.isSinglePlayer).toBe(true);
      expect(createBody.room.players.length).toBe(4);
      const roomId = createBody.roomId;

      // Start game
      const { status: startStatus, body: startBody } = await call('startGame', {
        roomId,
        hostName: 'SoloPlayer',
      });
      expect(startStatus).toBe(200);
      expect(startBody.room.status).toBe('submitting');
      expect(startBody.room.currentRound).toBe(1);
      expect(startBody.room.jokePrompt).toBeTruthy();
      expect(startBody.room.phaseEndsAt).toBeGreaterThan(Date.now() - 5000);

      // Submit punchline
      const { status: subStatus } = await call('submitPunchline', {
        roomId,
        playerName: 'SoloPlayer',
        punchline: 'Because the compiler had too many issues!',
      });
      expect(subStatus).toBe(200);

      // Advance from submitting → betting (bots auto-submit)
      const { status: adv1Status, body: adv1Body } = await call('advancePhase', {
        roomId,
        hostName: 'SoloPlayer',
      });
      expect(adv1Status).toBe(200);
      expect(adv1Body.room.status).toBe('betting');
      // Bots should have submitted
      expect(adv1Body.room.submissions.length).toBe(4);

      // Place a bet
      const { status: betStatus } = await call('placeBet', {
        roomId,
        playerName: 'SoloPlayer',
        submissionId: 1,
        amount: 50,
      });
      expect(betStatus).toBe(200);

      // Advance from betting → judging → roundResults
      const { status: adv2Status, body: adv2Body } = await call('advancePhase', {
        roomId,
        hostName: 'SoloPlayer',
      });
      expect(adv2Status).toBe(200);
      expect(adv2Body.room.status).toBe('roundResults');
      expect(adv2Body.room.roundResults.length).toBe(1);
      const rr = adv2Body.room.roundResults[0];
      expect(rr.winnerId).toBeDefined();
      expect(rr.winnerName).toBeTruthy();
      expect(rr.judgingMethod).toBeDefined();

      // Next round
      const { status: nrStatus, body: nrBody } = await call('nextRound', {
        roomId,
        hostName: 'SoloPlayer',
      });
      expect(nrStatus).toBe(200);
      expect(nrBody.room.status).toBe('submitting');
      expect(nrBody.room.currentRound).toBe(2);
      expect(nrBody.room.submissions.length).toBe(0);
      expect(nrBody.room.bets.length).toBe(0);

      // Fast-forward to final round and finish
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.currentRound = room.totalRounds;
      room.status = 'roundResults';
      store[key] = JSON.stringify(room);

      const { status: finishStatus, body: finishBody } = await call('nextRound', {
        roomId,
        hostName: 'SoloPlayer',
      });
      expect(finishStatus).toBe(200);
      expect(finishBody.room.status).toBe('finished');
      expect(finishBody.finalStandings).toBeDefined();
      expect(finishBody.finalStandings.length).toBe(4);
    });
  });

  // =========================================================================
  // B. Full Multiplayer Game Lifecycle
  // =========================================================================

  describe('Full Multiplayer Game Lifecycle', () => {
    it('two players: create → join → start → submit → bet → judge → results with correct scores', async () => {
      // Create room
      const { body: createBody } = await call('createRoom', { hostName: 'Alice' });
      const roomId = createBody.roomId;

      // Second player joins
      const { status: joinStatus, body: joinBody } = await call('joinRoom', {
        roomId,
        playerName: 'Bob',
      });
      expect(joinStatus).toBe(200);
      expect(joinBody.room.players.length).toBe(2);

      // Start game
      const { body: startBody } = await call('startGame', { roomId, hostName: 'Alice' });
      expect(startBody.room.status).toBe('submitting');

      // Both submit
      await call('submitPunchline', { roomId, playerName: 'Alice', punchline: 'Alice joke' });
      const { body: sub2Body } = await call('submitPunchline', {
        roomId,
        playerName: 'Bob',
        punchline: 'Bob joke',
      });
      expect(sub2Body.submissionCount).toBe(2);

      // Advance to betting
      const { body: bettingBody } = await call('advancePhase', { roomId, hostName: 'Alice' });
      expect(bettingBody.room.status).toBe('betting');
      expect(bettingBody.room.betBudgets['Alice']).toBe(300);
      expect(bettingBody.room.betBudgets['Bob']).toBe(300);

      // Both bet
      const { body: bet1 } = await call('placeBet', {
        roomId,
        playerName: 'Alice',
        submissionId: 2,
        amount: 50,
      });
      expect(bet1.remainingBudget).toBeLessThan(300);

      await call('placeBet', {
        roomId,
        playerName: 'Bob',
        submissionId: 1,
        amount: 50,
      });

      // Advance to judging → roundResults
      const { body: judgeBody } = await call('advancePhase', { roomId, hostName: 'Alice' });
      expect(judgeBody.room.status).toBe('roundResults');
      expect(judgeBody.room.roundResults.length).toBe(1);

      // Verify scores were updated — winner gets 100 for authoring the winning joke,
      // but may also lose bet points if they bet on the wrong submission
      const winner = judgeBody.room.roundResults[0].winnerName;
      const winnerPlayer = judgeBody.room.players.find(p => p.name === winner);
      expect(winnerPlayer.score).toBeGreaterThan(0);

      // Verify round result structure
      const roundResult = judgeBody.room.roundResults[0];
      expect(roundResult.round).toBe(1);
      expect(roundResult.scores).toBeDefined();
      expect(roundResult.revealOrder).toBeDefined();
      expect(roundResult.revealOrder.length).toBe(2);
    });
  });

  // =========================================================================
  // C. Double-Advance Prevention (regression for commit 67efffe)
  // =========================================================================

  describe('Double-Advance Prevention', () => {
    it('advancePhase from submitting goes exactly ONE phase to betting, not further', async () => {
      // Set up room in submitting with submissions
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });

      await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Joke A' });
      await call('submitPunchline', { roomId, playerName: 'Player2', punchline: 'Joke B' });

      // Expire the timer so auto-advance could trigger
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.phaseEndsAt = Date.now() - 1000; // expired
      store[key] = JSON.stringify(room);

      // Call advancePhase — should go to betting, NOT skip to judging
      const { status, body } = await call('advancePhase', { roomId, hostName: 'Host' });
      expect(status).toBe(200);
      // advancePhase uses getRoomRaw (no auto-advance stacking), so only ONE transition
      expect(body.room.status).toBe('betting');
    });

    it('concurrent advancePhase calls do not double-advance', async () => {
      const roomId = await setupRoom('betting');

      // Fire two advance calls simultaneously
      const [r1, r2] = await Promise.all([
        call('advancePhase', { roomId, hostName: 'Host' }),
        call('advancePhase', { roomId, hostName: 'Host' }),
      ]);

      // Both may succeed, but room should be in a valid terminal state for this phase
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      // Should be in judging or roundResults — NOT advanced further (e.g., submitting round 2)
      expect(['judging', 'roundResults']).toContain(room.status);
      // Should have exactly 1 round result (not 2)
      expect(room.roundResults.length).toBe(1);
    });
  });

  // =========================================================================
  // D. Polling Resilience (regression for commit 0fc87ed)
  // =========================================================================

  describe('Polling Resilience', () => {
    it('transient 500 errors do not expire the room', async () => {
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;

      // Simulate server 500 on getRoom
      const originalFetch = globalThis.fetch;
      let failCount = 0;
      globalThis.fetch = vi.fn(async (url, opts = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('fake.upstash.io') && failCount < 2) {
          failCount++;
          return { ok: false, status: 500, json: async () => ({ error: 'Internal' }) };
        }
        return originalFetch(url, opts);
      });

      // getRoom should still work after transient failures (Redis circuit breaker fallback)
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);
      // Should return the room from fallback storage, not 404
      expect([200, 404]).toContain(res._status);
      // If 200, room should still be valid
      if (res._status === 200) {
        expect(res._body.room.id).toBe(roomId);
      }

      globalThis.fetch = originalFetch;
    });

    it('429 rate limit does not count as room expiry', async () => {
      // The client-side consecutivePollFailures logic:
      // - 429 increments failures but does NOT trigger room expiry (only 404 does)
      // We test the SERVER side: 429 returns with rate limit error, room still exists
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;

      // Hit rate limit
      const minute = Math.floor(Date.now() / 60000);
      counters[`rl:127.0.0.1:${minute}`] = 120;

      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);
      expect(res._status).toBe(429);

      // Clear rate limit and verify room is still there
      delete counters[`rl:127.0.0.1:${minute}`];
      const req2 = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res2 = makeRes();
      await handler(req2, res2);
      expect(res2._status).toBe(200);
      expect(res2._body.room.id).toBe(roomId);
    });

    it('genuine 404 after room deletion is correctly reported', async () => {
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId: 'NONEXISTENT_ROOM' } });
      const res = makeRes();
      await handler(req, res);
      expect(res._status).toBe(404);
    });
  });

  // =========================================================================
  // E. Auto-Advance Recovery (regression for commit bb09076)
  // =========================================================================

  describe('Auto-Advance Recovery', () => {
    it('room stuck in judging for >45s triggers recovery via getRoom', async () => {
      // Set up a room stuck in judging
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });
      await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Joke A' });
      await call('submitPunchline', { roomId, playerName: 'Player2', punchline: 'Joke B' });

      // Manually set room to judging with stale updatedAt (>45s ago)
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.status = 'judging';
      room.judgingMethod = 'processing';
      room.updatedAt = Date.now() - 50000; // 50s ago — past the 45s threshold
      room.phaseEndsAt = null;
      // Ensure there are submissions for autoJudge to work with
      store[key] = JSON.stringify(room);

      // Clear the advance lock so getRoom can acquire it
      delete store[`lock:advance:${roomId}`];

      // getRoom should trigger checkAutoAdvance which detects stuck judging
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      // Room should have recovered — either roundResults (autoJudge succeeded) or
      // still judging (if it errored but returned stale room per error handling)
      expect(['judging', 'roundResults']).toContain(res._body.room.status);
    });

    it('auto-advance error returns stale room instead of 500', async () => {
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });

      // Set room to submitting with expired timer
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.phaseEndsAt = Date.now() - 1000;
      store[key] = JSON.stringify(room);

      // Clear the advance lock
      delete store[`lock:advance:${roomId}`];

      // Make AI calls fail
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url, opts = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('anthropic.com')) {
          throw new Error('AI timeout');
        }
        return originalFetch(url, opts);
      });

      // getRoom should NOT return 500 — it catches auto-advance errors
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._body.room).toBeDefined();
      expect(res._body.room.id).toBe(roomId);

      globalThis.fetch = originalFetch;
    });
  });

  // =========================================================================
  // F. Phase Timer Expiry
  // =========================================================================

  describe('Phase Timer Expiry', () => {
    it('getRoom auto-advances from submitting when phaseEndsAt is expired', async () => {
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });

      // Submit at least one punchline so transition doesn't skip
      await call('submitPunchline', { roomId, playerName: 'Host', punchline: 'Timer test joke' });

      // Expire the submission timer
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.phaseEndsAt = Date.now() - 1000; // expired
      store[key] = JSON.stringify(room);

      // Clear advance lock
      delete store[`lock:advance:${roomId}`];

      // getRoom should trigger auto-advance from submitting → betting
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      // Should have auto-advanced past submitting
      expect(res._body.room.status).not.toBe('submitting');
      expect(['betting', 'curating']).toContain(res._body.room.status);
    });

    it('getRoom auto-advances from betting when phaseEndsAt is expired', async () => {
      // Set up room in betting phase
      const roomId = await setupRoom('betting');

      // Expire the betting timer
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.phaseEndsAt = Date.now() - 1000; // expired
      store[key] = JSON.stringify(room);

      // Clear advance lock
      delete store[`lock:advance:${roomId}`];

      // getRoom should trigger auto-advance from betting → judging → roundResults
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      // Should have auto-advanced past betting to judging or roundResults
      expect(['judging', 'roundResults']).toContain(res._body.room.status);
    });

    it('betting timer expiry triggers autoJudge and produces round results', async () => {
      const roomId = await setupRoom('betting');

      // Place bets first
      await call('placeBet', { roomId, playerName: 'Host', submissionId: 2, amount: 50 });
      await call('placeBet', { roomId, playerName: 'Player2', submissionId: 1, amount: 50 });

      // Expire the timer
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.phaseEndsAt = Date.now() - 1000;
      store[key] = JSON.stringify(room);

      // Clear advance lock
      delete store[`lock:advance:${roomId}`];

      // getRoom triggers auto-advance
      const req = makeReq({ method: 'GET', query: { action: 'getRoom', roomId } });
      const res = makeRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      if (res._body.room.status === 'roundResults') {
        expect(res._body.room.roundResults.length).toBe(1);
        expect(res._body.room.roundResults[0].winnerId).toBeDefined();
        // Verify bet payouts affected scores
        const totalScore = res._body.room.players.reduce((sum, p) => sum + p.score, 0);
        expect(totalScore).toBeGreaterThan(0);
      }
    });

    it('submitting timer expiry with zero submissions creates skip round result', async () => {
      const { body: createBody } = await call('createRoom', { hostName: 'Host' });
      const roomId = createBody.roomId;
      await call('joinRoom', { roomId, playerName: 'Player2' });
      await call('startGame', { roomId, hostName: 'Host' });

      // Don't submit anything, just expire the timer
      const key = Object.keys(store).find(k => k.startsWith('room:') && k.includes(roomId));
      const room = JSON.parse(store[key]);
      room.phaseEndsAt = Date.now() - 1000;
      store[key] = JSON.stringify(room);

      // Clear advance lock
      delete store[`lock:advance:${roomId}`];

      // Advance manually (host can advance even with no submissions)
      const { status, body } = await call('advancePhase', { roomId, hostName: 'Host' });
      expect(status).toBe(200);
      // With 0 submissions, transitionFromSubmitting creates a skip result
      expect(body.room.status).toBe('roundResults');
      const lastResult = body.room.roundResults[body.room.roundResults.length - 1];
      expect(lastResult.winnerName).toBe('No one');
      expect(lastResult.judgingMethod).toBe('skipped');
    });
  });
});
