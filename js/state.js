// Oracle of Wit — Global State (ES Module)

export let state = {
    screen: 'welcome',
    playerName: localStorage.getItem('playerName') || '',
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
    // Validator voting animation state
    validatorVotingStarted: false,
    validatorVotes: [],
    consensusReached: false,
    winningSubmissionId: null,
    // Weekly theme
    currentWeeklyTheme: null,
    // Reveal sequence state
    revealPhase: null,       // 'revealing' | 'winner' | null
    revealIndex: -1,         // which joke we're showing
    revealTimer: null,       // interval ref
    revealedJokes: [],       // jokes revealed so far
    // Emoji reactions
    sentReactions: 0,
    floatingEmojis: [],
    // Player profile
    playerId: localStorage.getItem('playerId') || null,
    profile: null,
    allAchievements: [],
    nextLevelXP: null,
    // Daily challenge
    dailyChallenge: null,
    dailyResult: null,
    dailySubmitting: false,
    // Hall of fame
    hallOfFame: [],
    showHallOfFame: false,
    // Friend challenge
    challengeData: null,
    challengeResult: null,
    // Appeal
    appealInProgress: false,
    appealResult: null,
    // Community prompts
    communityPrompts: [],
    showCommunityPrompts: false,
    // Audience voting (large rooms)
    votedFor: null,
};

export let pollInterval = null;
export function setPollInterval(val) { pollInterval = val; }

export let timerRAF = null;
export function setTimerRAF(val) { timerRAF = val; }

export let lastTimerSecond = -1;
export function setLastTimerSecond(val) { lastTimerSecond = val; }

export let renderPending = false;
export function setRenderPending(val) { renderPending = val; }

export let lastRenderTime = 0;
export function setLastRenderTime(val) { lastRenderTime = val; }

export const MIN_RENDER_INTERVAL = 100; // Minimum ms between renders

export let validatorVotingInterval = null;
export function setValidatorVotingInterval(val) { validatorVotingInterval = val; }

export let gameEvents = []; // Track live game events for left wing

export let revealTimeouts = [];
export function setRevealTimeouts(val) { revealTimeouts = val; }

export let headerFloating = false;
export function setHeaderFloating(val) { headerFloating = val; }

// Session token for auth (set on createRoom/joinRoom)
export let sessionToken = null;
export function setSessionToken(val) { sessionToken = val; }
