// Handler router map — maps action names to handler functions

import { createRoom, joinRoom, getRoom, listRooms } from './room.js';
import { startGame, submitPunchline, placeBet, castVote, advancePhase, nextRound, sendReaction } from './gameplay.js';
import { getLeaderboard, getProfileHandler, createProfile, getDailyChallenge, submitDailyChallenge, getPlayerHistory, getSeasonalLeaderboard, getSeasonArchive, requestNonce, verifyWallet } from './profile.js';
import { createChallenge, getChallenge, appealVerdict, ogPreview, createShare, getHallOfFame, submitPrompt, votePrompt, getPromptSubmissions } from './social.js';
import { getWeeklyTheme } from './meta.js';

export const handlers = {
    createRoom,
    joinRoom,
    getRoom,
    listRooms,
    startGame,
    submitPunchline,
    placeBet,
    castVote,
    advancePhase,
    nextRound,
    sendReaction,
    getLeaderboard,
    getProfile: getProfileHandler,
    createProfile,
    getDailyChallenge,
    submitDailyChallenge,
    getPlayerHistory,
    getSeasonalLeaderboard,
    getSeasonArchive,
    createChallenge,
    getChallenge,
    appealVerdict,
    ogPreview,
    createShare,
    getHallOfFame,
    submitPrompt,
    votePrompt,
    getPromptSubmissions,
    getWeeklyTheme,
    requestNonce,
    verifyWallet,
};
