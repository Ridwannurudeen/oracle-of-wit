// Preact signals bridge — mirrors state.js for incremental Preact migration
// Islands architecture: Preact components read from signals,
// syncFromLegacyState() keeps them updated from the vanilla JS state object.

import { signal, computed } from '@preact/signals';

// Core state signals
export const screen = signal('welcome');
export const playerName = signal('');
export const roomId = signal(null);
export const room = signal(null);
export const isHost = signal(false);
export const loading = signal(false);
export const error = signal(null);
export const profile = signal(null);
export const walletAddress = signal(null);
export const isWalletConnected = signal(false);
export const walletConnecting = signal(false);
export const timeLeft = signal(0);
export const hasSubmitted = signal(false);
export const hasBet = signal(false);
export const votedFor = signal(null);
export const sentReactions = signal(0);

// Computed signals
export const currentPhase = computed(() => room.value?.status || 'idle');
export const playerCount = computed(() => room.value?.players?.length || 0);
export const currentRound = computed(() => room.value?.currentRound || 0);
export const totalRounds = computed(() => room.value?.totalRounds || 5);
export const phaseEndsAt = computed(() => room.value?.phaseEndsAt || 0);

export const xpProgress = computed(() => {
    const p = profile.value;
    if (!p) return 0;
    const currentXP = p.lifetimeXP || 0;
    // Simple progress within current level bracket
    const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 9000, 13000];
    const currentLevel = p.level || 1;
    const currentThreshold = levelThresholds[currentLevel - 1] || 0;
    const nextThreshold = levelThresholds[currentLevel] || currentThreshold + 1000;
    return Math.min(100, ((currentXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
});

export const walletDisplayAddress = computed(() => {
    const addr = walletAddress.value;
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
});

/**
 * Sync Preact signals from the legacy vanilla JS state object.
 * Call this at the end of render() to keep signals up-to-date.
 * @param {Object} state - The legacy state object from state.js
 */
export function syncFromLegacyState(state) {
    screen.value = state.screen;
    playerName.value = state.playerName;
    roomId.value = state.roomId;
    room.value = state.room;
    isHost.value = state.isHost;
    loading.value = state.loading;
    error.value = state.error;
    profile.value = state.profile;
    walletAddress.value = state.walletAddress;
    isWalletConnected.value = state.isWalletConnected;
    walletConnecting.value = state.walletConnecting || false;
    timeLeft.value = state.timeLeft;
    hasSubmitted.value = state.hasSubmitted;
    hasBet.value = state.hasBet;
    votedFor.value = state.votedFor;
    sentReactions.value = state.sentReactions;
}
