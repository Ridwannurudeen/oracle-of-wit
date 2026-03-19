/**
 * @module events
 * @description Event delegation module. Registers global listeners for click, input,
 * focus, blur, keypress, keydown, keyup, and mouseenter events. Routes actions via
 * `data-action`, `data-action-input`, `data-action-focus`, `data-action-blur`,
 * `data-action-keypress`, `data-action-keydown`, `data-action-keyup`, and
 * `data-hover-sound` attributes.
 */

import { state } from './state.js';
import { setTyping, updateCharCount } from './api.js';
import { playSound, oracleEye3D, skipReveal } from './effects.js';
import { render } from './render.js';
import {
    toggleSound, startBootSequence, leaveRoom, joinRoom, createRoom,
    startGame, submitPunchline, advancePhase, selectSubmission,
    sendReaction, placeBet, castVote, appealVerdict, nextRound,
    createChallengeLink, shareRoundResult, shareFinalResult,
    copyShareText, tweetResult, fetchDailyChallenge, submitDailyChallenge,
    fetchCommunityPrompts, submitCommunityPrompt, voteCommunityPrompt,
    fetchHallOfFame, copyRoomCode, updateBetDisplay, fetchProfile,
    connectWallet, disconnectWallet
} from './app.js';

// === CLICK EVENT DELEGATION ===
document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
        // --- Header ---
        case 'toggleSound':
            toggleSound();
            break;

        // --- Error dismiss ---
        case 'dismissError':
            state.error = null;
            render();
            break;

        // --- HUD exit ---
        case 'confirmLeaveRoom':
            if (confirm('Leave this game?')) leaveRoom();
            break;

        // --- Welcome screen ---
        case 'startBootSequence':
            startBootSequence();
            break;

        // --- Navigation ---
        case 'goToProfile':
            state.screen = 'profile';
            render();
            break;
        case 'backToLobby':
            state.screen = 'lobby';
            render();
            break;
        case 'backToLobbyFromDailyResult':
            state.screen = 'lobby';
            state.dailyResult = null;
            state.dailyChallenge = null;
            fetchProfile();
            render();
            break;
        case 'backToLobbyFromDaily':
            state.screen = 'lobby';
            state.dailyChallenge = null;
            render();
            break;
        case 'backToLobbyFromHallOfFame':
            state.screen = 'lobby';
            state.showHallOfFame = false;
            render();
            break;
        case 'backToLobbyFromCommunity':
            state.screen = 'lobby';
            state.showCommunityPrompts = false;
            render();
            break;

        // --- Lobby tabs ---
        case 'showLeaderboardTab':
            playSound('tab');
            state.showHallOfFame = false;
            render();
            break;
        case 'showHallOfFameTab':
            playSound('tab');
            fetchHallOfFame();
            break;

        // --- Room management ---
        case 'createRoom':
            createRoom(target.dataset.category, target.dataset.singlePlayer === 'true');
            break;
        case 'joinRoom':
            joinRoom(target.dataset.roomId);
            break;
        case 'joinRoomFromInput':
            joinRoom(document.getElementById('room-code').value);
            break;
        case 'copyRoomCode':
            copyRoomCode(target.dataset.roomId);
            break;
        case 'leaveRoom':
            leaveRoom();
            break;
        case 'startGame':
            startGame();
            break;

        // --- Game actions ---
        case 'submitPunchline':
            submitPunchline();
            break;
        case 'advancePhase':
            advancePhase();
            break;
        case 'selectSubmission':
            selectSubmission(parseInt(target.dataset.submissionId, 10));
            break;
        case 'sendReaction':
            e.stopPropagation();
            sendReaction(parseInt(target.dataset.submissionId, 10), target.dataset.emoji);
            break;
        case 'placeBet':
            placeBet();
            break;
        case 'castVote':
            castVote(parseInt(target.dataset.submissionId, 10));
            break;

        // --- Results ---
        case 'skipReveal':
            skipReveal();
            break;
        case 'appealVerdict':
            appealVerdict();
            break;
        case 'nextRound':
            nextRound();
            break;
        case 'createChallengeLink':
            createChallengeLink();
            break;
        case 'shareRoundResult':
            shareRoundResult();
            break;
        case 'shareFinalResult':
            shareFinalResult();
            break;
        case 'copyShareText':
            copyShareText(
                parseInt(target.dataset.playerScore, 10),
                parseInt(target.dataset.roundsWon, 10),
                parseInt(target.dataset.totalRounds, 10)
            );
            break;
        case 'tweetResult':
            tweetResult(
                parseInt(target.dataset.playerScore, 10),
                parseInt(target.dataset.roundsWon, 10),
                parseInt(target.dataset.totalRounds, 10)
            );
            break;

        // --- Daily challenge ---
        case 'fetchDailyChallenge':
            fetchDailyChallenge();
            break;
        case 'submitDailyChallenge':
            submitDailyChallenge();
            break;

        // --- Community prompts ---
        case 'fetchCommunityPrompts':
            fetchCommunityPrompts();
            break;
        case 'submitCommunityPrompt':
            submitCommunityPrompt();
            break;
        case 'voteCommunityPrompt':
            voteCommunityPrompt(target.dataset.promptId);
            break;

        // --- Wallet ---
        case 'connectWallet':
            connectWallet();
            break;
        case 'disconnectWallet':
            disconnectWallet();
            break;
    }
});

// === INPUT EVENT DELEGATION ===
document.addEventListener('input', function(e) {
    const target = e.target;
    const action = target.dataset.actionInput;
    if (!action) return;

    switch (action) {
        case 'playerNameInput':
            state.playerName = target.value;
            if (typeof oracleEye3D !== 'undefined') oracleEye3D.dilate();
            break;
        case 'punchlineInput':
            state.punchlineText = target.value;
            setTyping();
            updateCharCount();
            break;
        case 'betSlider':
            state.betAmount = +target.value;
            updateBetDisplay();
            break;
    }
});

// === FOCUS EVENT DELEGATION ===
document.addEventListener('focus', function(e) {
    const target = e.target;
    const action = target.dataset.actionFocus;
    if (!action) return;

    switch (action) {
        case 'playerNameFocus':
            if (typeof oracleEye3D !== 'undefined') oracleEye3D.dilate();
            break;
        case 'punchlineFocus':
            setTyping();
            break;
    }
}, true); // Use capture for focus events

// === BLUR EVENT DELEGATION ===
document.addEventListener('blur', function(e) {
    const target = e.target;
    const action = target.dataset.actionBlur;
    if (!action) return;

    switch (action) {
        case 'playerNameBlur':
            if (typeof oracleEye3D !== 'undefined') oracleEye3D.undilate();
            break;
    }
}, true); // Use capture for blur events

// === KEYPRESS EVENT DELEGATION ===
document.addEventListener('keypress', function(e) {
    const target = e.target;
    const action = target.dataset.actionKeypress;
    if (!action) return;

    switch (action) {
        case 'playerNameKeypress':
            if (e.key === 'Enter') startBootSequence();
            break;
        case 'roomCodeKeypress':
            if (e.key === 'Enter') joinRoom(target.value);
            break;
    }
});

// === KEYDOWN EVENT DELEGATION ===
document.addEventListener('keydown', function(e) {
    const target = e.target;
    const action = target.dataset.actionKeydown;
    if (!action) return;

    switch (action) {
        case 'punchlineKeydown':
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                submitPunchline();
            } else {
                setTyping();
            }
            break;
        case 'dailyPunchlineKeydown':
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                submitDailyChallenge();
            }
            break;
        case 'communityPromptKeydown':
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                submitCommunityPrompt();
            }
            break;
    }
});

// === KEYUP EVENT DELEGATION ===
document.addEventListener('keyup', function(e) {
    const target = e.target;
    const action = target.dataset.actionKeyup;
    if (!action) return;

    switch (action) {
        case 'punchlineKeyup':
            setTyping();
            break;
    }
});

// === MOUSEENTER EVENT DELEGATION (for hover sounds) ===
document.addEventListener('mouseenter', function(e) {
    const target = e.target.closest?.('[data-hover-sound]');
    if (target) {
        playSound('hover');
    }
}, true);
