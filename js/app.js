// Oracle of Wit — Game Actions, Timer, Boot, Event Handlers (ES Module)

import { state, sessionToken, setSessionToken, headerFloating, setHeaderFloating, timerRAF, setTimerRAF, lastTimerSecond, setLastTimerSecond } from './state.js';
import { API_URL, api, fetchRoom, startPolling, stopPolling, fetchPublicRooms, fetchLeaderboard, soundEnabled, setSoundEnabled, isTyping, setIsTyping, typingTimeout, updateTimerDisplay, setTyping } from './api.js';
import { playSound, initAudio, createConfetti, oracleEye3D, startRevealSequence, stopRevealSequence, startValidatorVoting, stopValidatorVoting } from './effects.js';
import { addGameEvent, formatTime } from './render-helpers.js';
import { render } from './render.js';

// ─── Timer Functions ────────────────────────────────────────────

export function syncTimer() {
    if (!state.room?.phaseEndsAt) { state.timeLeft = 0; return; }
    state.timeLeft = Math.max(0, Math.floor((state.room.phaseEndsAt - Date.now()) / 1000));
}

function startTimer() {
    stopTimer();
    setLastTimerSecond(-1);
    function tick() {
        if (state.room?.phaseEndsAt) {
            state.timeLeft = Math.max(0, Math.floor((state.room.phaseEndsAt - Date.now()) / 1000));
        }
        if (state.timeLeft !== lastTimerSecond) {
            setLastTimerSecond(state.timeLeft);
            if (state.timeLeft <= 5 && state.timeLeft > 0) playSound('tick');
            if (state.timeLeft === 10) playSound('warning');
            updateTimerDisplay();
        }
        setTimerRAF(requestAnimationFrame(tick));
    }
    setTimerRAF(requestAnimationFrame(tick));
}

function stopTimer() {
    if (timerRAF) { cancelAnimationFrame(timerRAF); setTimerRAF(null); }
    setLastTimerSecond(-1);
}

// ─── Phase Change Handler ───────────────────────────────────────

export function handlePhaseChange(oldStatus, newStatus) {
    // Always clean up reveal state on any phase transition
    stopRevealSequence();
    state._isRevealing = false;
    // Reset typing flag on phase change
    setIsTyping(false);
    if (typingTimeout) clearTimeout(typingTimeout);

    state.screen = newStatus === 'roundResults' ? 'roundResults' : newStatus;
    // Track game events for HUD wings
    if (newStatus === 'submitting') addGameEvent('round', 'Round ' + (state.room?.currentRound || '?') + ' started');
    if (newStatus === 'betting') addGameEvent('phase', 'Betting phase opened');
    if (newStatus === 'judging') addGameEvent('oracle', 'Oracle judging in progress');
    if (newStatus === 'roundResults') addGameEvent('result', 'Round results revealed');
    if (newStatus === 'finished') addGameEvent('end', 'Game complete!');
    if (newStatus === 'submitting') {
        playSound('start');
        state.hasSubmitted = false;
        state.punchlineText = '';
        // Reset validator voting state for new round
        state.validatorVotingStarted = false;
        state.validatorVotes = [];
        state.consensusReached = false;
        state.winningSubmissionId = null;
        state.sentReactions = 0;
        syncTimer();
        startTimer();
    } else if (newStatus === 'curating') {
        playSound('click');
    } else if (newStatus === 'voting') {
        playSound('click');
        state.votedFor = null;
        syncTimer();
        startTimer();
    } else if (newStatus === 'betting') {
        playSound('click');
        state.hasBet = false;
        state.selectedSubmission = null;
        state.sentReactions = 0;
        syncTimer();
        startTimer();
    } else if (newStatus === 'roundResults') {
        stopTimer();
        stopValidatorVoting();
        generateFinalValidatorVotes();
        // Start dramatic reveal instead of jumping to results (with guard)
        if (!state._isRevealing) {
            state.revealPhase = 'revealing';
            state.revealIndex = -1;
            state.revealedJokes = [];
            state.sentReactions = 0;
            state._isRevealing = true;
            startRevealSequence();
        }
    } else if (newStatus === 'finished') {
        stopTimer();
        stopPolling();
        stopValidatorVoting();
        playSound('win');
        createConfetti();
    } else if (newStatus === 'judging') {
        stopTimer();
        // Reset for new judging phase
        state.validatorVotingStarted = false;
        state.validatorVotes = [];
        state.consensusReached = false;
    }
}

// ─── Generate Validator Votes ───────────────────────────────────

// Generate validator votes based on actual round result
export function generateFinalValidatorVotes() {
    const result = state.room?.roundResults?.[state.room.roundResults.length - 1];
    if (!result) return;

    const winnerId = result.winnerId;
    const submissions = state.room?.submissions || [];
    const otherIds = submissions.map(s => s.id).filter(id => id !== winnerId);

    // Generate 5 validator votes - majority (4-5) agree on winner
    state.validatorVotes = [];
    for (let i = 0; i < 5; i++) {
        // 4 validators agree, 1 might disagree (to show democracy)
        if (i < 4 || Math.random() > 0.5) {
            state.validatorVotes.push(winnerId);
        } else if (otherIds.length > 0) {
            // One validator disagrees
            state.validatorVotes.push(otherIds[Math.floor(Math.random() * otherIds.length)]);
        } else {
            state.validatorVotes.push(winnerId);
        }
    }
    state.consensusReached = true;
    state.winningSubmissionId = winnerId;
}

// ─── Game Actions ───────────────────────────────────────────────

export async function createRoom(category, singlePlayer = false) {
    initAudio();
    playSound('click');
    try {
        const result = await api('createRoom', { hostName: state.playerName, category, singlePlayer });
        state.roomId = result.roomId;
        setSessionToken(result.sessionToken || null);
        state.room = result.room;
        state.isHost = true;
        state.screen = 'waiting';
        localStorage.setItem('playerName', state.playerName);
        startPolling();
        render();
    } catch (e) { state.error = 'Failed to create room. Try again.'; render(); }
}

export async function joinRoom(roomId) {
    if (!roomId?.trim()) { state.error = 'Enter room code'; render(); return; }
    initAudio();
    playSound('click');
    try {
        const result = await api('joinRoom', { roomId: roomId.toUpperCase(), playerName: state.playerName });
        state.roomId = roomId.toUpperCase();
        setSessionToken(result.sessionToken || null);
        state.room = result.room;
        state.isHost = state.room.host === state.playerName;
        state.screen = 'waiting';
        localStorage.setItem('playerName', state.playerName);
        startPolling();
        render();
    } catch (e) { state.error = e.message || 'Room not found or full.'; render(); }
}

export async function startGame() {
    if (state.loading) return; // Prevent double-click
    playSound('start');
    try {
        const result = await api('startGame', { roomId: state.roomId, hostName: state.playerName });
        state.room = result.room;
        state.screen = 'submitting';
        state.hasSubmitted = false;
        state.punchlineText = '';
        syncTimer();
        startTimer();
        render();
    } catch (e) { state.error = e.message || 'Failed to start game.'; render(); }
}

export async function submitPunchline() {
    const text = state.punchlineText.trim();
    if (!text) { state.error = 'Write a punchline first'; render(true); return; }
    // Reset typing flag since user is done typing
    setIsTyping(false);
    if (typingTimeout) clearTimeout(typingTimeout);
    playSound('submit');
    // Optimistic update
    state.hasSubmitted = true;
    render(true);
    try {
        await api('submitPunchline', { roomId: state.roomId, playerName: state.playerName, punchline: text });
    } catch (e) {
        state.hasSubmitted = false; // Revert on error
        state.error = e.message || 'Failed to submit. Try again.';
        render(true);
    }
}

export async function castVote(submissionId) {
    if (state.votedFor) return;
    playSound('bet');
    // Optimistic update
    state.votedFor = submissionId;
    if (state.room?.audienceVotes) state.room.audienceVotes[state.playerName] = submissionId;
    render();
    try {
        await api('castVote', { roomId: state.roomId, playerName: state.playerName, submissionId });
    } catch (e) {
        state.votedFor = null; // Revert on error
        if (state.room?.audienceVotes) delete state.room.audienceVotes[state.playerName];
        if (e.message) { state.error = e.message; render(); }
    }
}

export async function placeBet() {
    if (!state.selectedSubmission) { state.error = 'Select a submission first'; render(); return; }
    playSound('bet');
    // Optimistic update
    state.hasBet = true;
    render();
    try {
        const result = await api('placeBet', { roomId: state.roomId, playerName: state.playerName, submissionId: state.selectedSubmission, amount: state.betAmount });
        if (result.remainingBudget !== undefined && state.room?.betBudgets) {
            state.room.betBudgets[state.playerName] = result.remainingBudget;
        }
        render();
    } catch (e) {
        state.hasBet = false; // Revert on error
        if (e.message?.includes('No budget')) { state.error = 'No betting budget left!'; }
        render();
    }
}

export async function sendReaction(submissionId, emoji) {
    if (state.sentReactions >= 3) return;
    try {
        await api('sendReaction', { roomId: state.roomId, playerName: state.playerName, submissionId, emoji });
        state.sentReactions++;
        render();
    } catch (e) {}
}

export async function advancePhase() {
    playSound('click');
    try {
        const result = await api('advancePhase', { roomId: state.roomId, hostName: state.playerName });
        state.room = result.room;
        render();
    } catch (e) { state.error = e.message || 'Failed to advance phase.'; render(); }
}

export async function nextRound() {
    playSound('click');
    try {
        const result = await api('nextRound', { roomId: state.roomId, hostName: state.playerName, playerId: state.playerId });
        state.room = result.room;
        if (result.room.status === 'finished') {
            state.screen = 'finished';
            state.leaderboard = result.leaderboard || [];
            if (result.profileUpdate) {
                state.profile = result.profileUpdate.profile;
                state.nextLevelXP = getNextLevelXPClient(state.profile.lifetimeXP);
                if (result.profileUpdate.newAchievements?.length > 0) {
                    result.profileUpdate.newAchievements.forEach(a => showAchievementToast(a));
                }
            }
            stopPolling();
            stopTimer();
            playSound('win');
            createConfetti();
        } else {
            state.screen = 'submitting';
            state.hasSubmitted = false;
            state.punchlineText = '';
            state.appealResult = null;
            state.appealInProgress = false;
            playSound('start');
            syncTimer();
            startTimer();
        }
        render();
    } catch (e) {
        // Room expired or not found — auto-recover to lobby
        playSound('loss');
        leaveRoom();
        state.error = 'Room expired. Returned to lobby.';
        render(true);
    }
}

export function leaveRoom() {
    playSound('click');
    stopPolling();
    stopTimer();
    stopRevealSequence();
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
    setSessionToken(null);
    fetchPublicRooms();
    fetchProfile();
    render();
}

// ─── Lobby / Profile Functions ──────────────────────────────────

export async function loadWeeklyTheme() {
    try {
        const res = await fetch(`${API_URL}?action=getWeeklyTheme`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const result = await res.json();
        if (result.success) { state.currentWeeklyTheme = result.theme; render(); }
    } catch(e) { console.warn('Failed to load weekly theme:', e.message); }
}

export function startBootSequence() {
    if (!state.playerName.trim()) { state.error = 'Enter your name'; render(); return; }
    initAudio();
    playSound('click');

    const container = document.getElementById('boot-container');
    if (!container) { goToLobby(); return; }

    const steps = ['CONNECTING...', 'VALIDATING IDENTITY...', 'LOADING PROTOCOL...', 'SESSION ACTIVE'];
    let step = 0;

    container.innerHTML = `
        <div class="text-left">
            <div id="boot-steps" class="space-y-1 mb-3"></div>
            <div class="h-[3px] bg-obsidian rounded-full overflow-hidden border border-white/[0.04]">
                <div id="boot-bar" class="boot-progress" style="width:0%"></div>
            </div>
        </div>
    `;

    const stepsEl = document.getElementById('boot-steps');
    const barEl = document.getElementById('boot-bar');

    function showStep() {
        if (step >= steps.length) {
            playSound('start');
            setTimeout(goToLobby, 300);
            return;
        }
        playSound('tick');
        const isLast = step === steps.length - 1;
        const stepEl = document.createElement('div');
        stepEl.className = 'flex items-center gap-2';
        stepEl.innerHTML = `
            <span class="text-[10px] font-mono ${isLast ? 'text-green-400' : 'text-wit'}">${isLast ? '&#10003;' : '&gt;'}</span>
            <span class="text-[11px] font-mono ${isLast ? 'text-green-400' : 'text-gray-400'} boot-text">${steps[step]}</span>
        `;
        stepsEl.appendChild(stepEl);
        if (barEl) barEl.style.width = ((step + 1) / steps.length * 100) + '%';
        step++;
        setTimeout(showStep, 400);
    }
    showStep();
}

export function goToLobby() {
    if (!state.playerName.trim()) { state.error = 'Enter your name'; render(); return; }
    initAudio();
    state.screen = 'lobby';
    localStorage.setItem('playerName', state.playerName);
    // Init playerId
    if (!state.playerId) {
        state.playerId = crypto.randomUUID();
        localStorage.setItem('playerId', state.playerId);
    }
    fetchPublicRooms();
    fetchLeaderboard();
    loadWeeklyTheme();
    fetchProfile();
    render();
}

export async function fetchProfile() {
    if (!state.playerId) return;
    try {
        const res = await fetch(`${API_URL}?action=createProfile`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: state.playerId, playerName: state.playerName })
        });
        const result = await res.json();
        if (result.success) {
            state.profile = result.profile;
            state.nextLevelXP = result.nextLevelXP;
            state.allAchievements = result.achievements || [];
            render();
        }
    } catch(e) { console.warn('Failed to fetch profile:', e.message); }
}

export async function fetchDailyChallenge() {
    try {
        const res = await fetch(`${API_URL}?action=getDailyChallenge`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: state.playerId })
        });
        const result = await res.json();
        if (result.success) {
            state.dailyChallenge = result.daily;
            state.screen = 'daily';
            render();
        }
    } catch(e) { console.warn('Failed to fetch daily challenge:', e.message); }
}

export async function submitDailyChallenge() {
    const text = document.getElementById('daily-punchline')?.value?.trim();
    if (!text) { state.error = 'Write a punchline first'; render(true); return; }
    state.dailySubmitting = true;
    render(true);
    try {
        const res = await fetch(`${API_URL}?action=submitDailyChallenge`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: state.playerId, playerName: state.playerName, punchline: text })
        });
        const result = await res.json();
        state.dailySubmitting = false;
        if (result.success) {
            state.dailyResult = result.result;
            if (result.result.profile) state.profile = result.result.profile;
            if (result.result.newAchievements?.length > 0) {
                result.result.newAchievements.forEach(a => showAchievementToast(a));
            }
            render(true);
        }
    } catch(e) { state.dailySubmitting = false; render(true); }
}

export async function fetchHallOfFame() {
    try {
        const res = await fetch(`${API_URL}?action=getHallOfFame`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const result = await res.json();
        if (result.success) { state.hallOfFame = result.hallOfFame || []; state.showHallOfFame = true; render(); }
    } catch(e) { console.warn('Failed to fetch hall of fame:', e.message); }
}

export async function appealVerdict() {
    if (state.appealInProgress || state.appealResult) return;
    state.appealInProgress = true;
    render(true);
    try {
        const res = await fetch(`${API_URL}?action=appealVerdict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: state.roomId, playerName: state.playerName, playerId: state.playerId })
        });
        const result = await res.json();
        state.appealInProgress = false;
        if (result.success) {
            state.appealResult = result.appeal;
            state.room = result.room;
            if (result.appeal.overturned) playSound('reveal');
            else playSound('loss');
            render(true);
        } else {
            state.error = result.error; render(true);
        }
    } catch(e) { state.appealInProgress = false; state.error = e.message; render(true); }
}

// ─── UI Utilities ───────────────────────────────────────────────

export function showAchievementToast(achievementId) {
    const a = state.allAchievements.find(x => x.id === achievementId);
    if (!a) return;
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[1000] glass rounded-xl px-6 py-3 border border-consensus/50 text-center toast-in';
    toast.innerHTML = `<p class="text-consensus font-mono font-bold text-xs tracking-wider">ACHIEVEMENT UNLOCKED</p><p class="text-lg mt-1">${a.icon} ${a.name}</p>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 500); }, 3000);
}

// Share card generation (Canvas API)
export function generateShareCard(prompt, punchline, playerName, score, roast) {
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 600, 400);
    grad.addColorStop(0, '#1e1b4b'); grad.addColorStop(0.5, '#312e81'); grad.addColorStop(1, '#4c1d95');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 600, 400);

    // Border
    ctx.strokeStyle = 'rgba(168,85,247,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 580, 380);

    // Title
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Oracle of Wit', 300, 45);
    ctx.fillStyle = '#a855f7'; ctx.font = '12px sans-serif';
    ctx.fillText('Powered by GenLayer', 300, 62);

    // Prompt
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif';
    wrapText(ctx, `"${prompt}"`, 300, 95, 520, 18);

    // Winning punchline
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif';
    const punchY = wrapText(ctx, `"${punchline}"`, 300, 150, 520, 22);

    // Author
    ctx.fillStyle = '#fbbf24'; ctx.font = '14px sans-serif';
    ctx.fillText(`by ${playerName}`, 300, punchY + 25);

    // Roast
    if (roast) {
        ctx.fillStyle = '#94a3b8'; ctx.font = 'italic 13px sans-serif';
        wrapText(ctx, roast, 300, punchY + 55, 520, 17);
    }

    // Score
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${score} XP`, 300, 340);

    // CTA
    ctx.fillStyle = '#6366f1'; ctx.font = '12px sans-serif';
    ctx.fillText('oracle-of-wit.vercel.app', 300, 375);

    return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '', curY = y;
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line.trim(), x, curY);
            line = word + ' '; curY += lineHeight;
        } else { line = test; }
    }
    ctx.fillText(line.trim(), x, curY);
    return curY;
}

export function shareImage(prompt, punchline, playerName, score, roast) {
    const canvas = generateShareCard(prompt, punchline, playerName, score, roast);
    canvas.toBlob(blob => {
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'oracle-of-wit.png', { type: 'image/png' })] })) {
            navigator.share({
                title: 'Oracle of Wit',
                text: `I scored ${score} XP on Oracle of Wit!`,
                files: [new File([blob], 'oracle-of-wit.png', { type: 'image/png' })]
            }).catch(() => {});
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'oracle-of-wit.png';
            a.click(); URL.revokeObjectURL(url);
        }
    }, 'image/png');
}

export function copyShareText(score, roundsWon, totalRounds) {
    const wins = roundsWon > 0 ? ` | ${roundsWon}/${totalRounds} rounds won` : '';
    const text = `Oracle of Wit | ${score} XP${wins} | oracle-of-wit.vercel.app`;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-share-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Text'; }, 2000); }
    }).catch(() => {});
}

export function tweetResult(score, roundsWon, totalRounds) {
    const wins = roundsWon > 0 ? ` ${roundsWon}/${totalRounds} rounds won.` : '';
    const text = encodeURIComponent(`I scored ${score} XP on Oracle of Wit!${wins}\n\nThe AI humor prediction game powered by @GenLayer\noracle-of-wit.vercel.app`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

export async function createChallengeLink() {
    if (!state.room) return;
    const result = state.room.roundResults?.[state.room.roundResults.length - 1];
    if (!result) return;
    try {
        const res = await fetch(`${API_URL}?action=createChallenge`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorName: state.playerName, creatorScore: state.room.players.find(p=>p.name===state.playerName)?.score || 0, prompt: state.room.jokePrompt, category: state.room.category })
        });
        const data = await res.json();
        if (data.success) {
            const url = `${window.location.origin}?challenge=${data.challengeId}`;
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.getElementById('challenge-btn');
                if (btn) { btn.textContent = 'Link Copied!'; setTimeout(() => { btn.textContent = 'Challenge a Friend'; }, 2000); }
            }).catch(() => {});
        }
    } catch(e) {}
}

// Detect challenge link on page load
export async function detectChallenge() {
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get('challenge');
    if (!challengeId) return;
    try {
        const res = await fetch(`${API_URL}?action=getChallenge&id=${encodeURIComponent(challengeId)}`);
        const data = await res.json();
        if (data.success) {
            state.challengeData = data.challenge;
            // Auto-start single-player with that prompt after entering name
        }
    } catch(e) {}
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
}

export function toggleSound() {
    setSoundEnabled(!soundEnabled);
    if (soundEnabled) { initAudio(); playSound('click'); }
    render();
}

export function selectSubmission(id) {
    state.selectedSubmission = id;
    playSound('click');
    render();
}

export function updateBetDisplay() {
    const el = document.getElementById('bet-amount-display');
    if (el) el.textContent = state.betAmount;
    const btn = document.getElementById('bet-submit-btn');
    if (btn) btn.textContent = 'BET ON #' + (state.selectedSubmission || '?');
}

export function copyRoomCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        playSound('click');
        const feedback = document.getElementById('copy-feedback');
        if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => feedback.classList.add('hidden'), 2000);
        }
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        playSound('click');
    });
}

export function toggleHelp() {
    state.showHelp = !state.showHelp;
    playSound('click');
    // Animate the toggle without full re-render
    const helpContent = document.getElementById('help-content');
    const toggleIcon = document.getElementById('help-toggle-icon');
    if (helpContent && toggleIcon) {
        helpContent.classList.toggle('hidden');
        toggleIcon.classList.toggle('rotate-180');
    }
}

// ─── Share Functions ────────────────────────────────────────────

export function shareRoundResult() {
    if (!state.room) return;
    const r = state.room;
    const result = r.roundResults?.[r.roundResults.length - 1];
    if (!result) return;
    shareImage(r.jokePrompt, result.winningPunchline, result.winnerName, result.scores?.[result.winnerName] || 100, result.aiCommentary?.winnerComment || null);
}

export function shareFinalResult() {
    if (!state.room) return;
    const r = state.room;
    const standings = [...r.players].sort((a,b) => b.score - a.score);
    const winner = standings[0];
    shareImage(r.jokePrompt || 'Oracle of Wit', winner.name + ' won!', state.playerName, r.players.find(p => p.name === state.playerName)?.score || 0, null);
}

// ─── Client Helpers ─────────────────────────────────────────────

export function getNextLevelXPClient(xp) {
    const thresholds = [0,500,1500,3000,6000,10000,20000,40000,75000,150000];
    for (const t of thresholds) {
        if (xp < t) return t;
    }
    return null;
}

// ─── Community Prompts ──────────────────────────────────────────

export async function fetchCommunityPrompts() {
    try {
        const res = await fetch(`${API_URL}?action=getPromptSubmissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const data = await res.json();
        if (data.success) {
            state.communityPrompts = data.prompts;
            state.showCommunityPrompts = true;
            state.screen = 'communityPrompts';
            render();
        }
    } catch(e) { console.warn('Failed to fetch community prompts:', e.message); }
}

export async function submitCommunityPrompt() {
    const input = document.getElementById('community-prompt-input');
    if (!input || !input.value.trim()) return;
    try {
        await api('submitPrompt', { playerName: state.playerName, prompt: input.value.trim(), playerId: state.playerId });
        input.value = '';
        fetchCommunityPrompts();
    } catch(e) {}
}

export async function voteCommunityPrompt(promptId) {
    try {
        await api('votePrompt', { promptId, playerId: state.playerId });
        fetchCommunityPrompts();
    } catch(e) {}
}

// ─── Event Listeners ────────────────────────────────────────────

// === FLOATING NAV ON SCROLL ===
window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (!header) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    if (scrollY > 50 && !headerFloating) {
        setHeaderFloating(true);
        header.classList.add('header-float');
        header.style.borderBottom = 'none';
    } else if (scrollY <= 50 && headerFloating) {
        setHeaderFloating(false);
        header.classList.remove('header-float');
        header.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
    }
}, { passive: true });

// === ENHANCED SOUND FX ===
// Add hover tick sound to buttons (very quiet)
document.addEventListener('mouseenter', e => {
    if (!soundEnabled || !audioCtx) return;
    const btn = e.target.closest?.('.btn');
    if (!btn) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.value = 2000; osc.type = 'sine';
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.05);
    } catch(e) {}
}, true);



// Online/offline detection
window.addEventListener('offline', () => {
    state.error = 'You are offline. Reconnect to continue.';
    render();
});
window.addEventListener('online', () => {
    state.error = null;
    if (state.roomId) { fetchRoom(); startPolling(); }
    render();
});

// Boot calls moved to main.js
