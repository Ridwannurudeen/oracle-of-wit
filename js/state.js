// Oracle of Wit — Global State
// Loaded first. All variables are global scope.

let state = {
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

let pollInterval = null;
let timerRAF = null;
let lastTimerSecond = -1;
let renderPending = false;
let lastRenderTime = 0;
const MIN_RENDER_INTERVAL = 100; // Minimum ms between renders

let validatorVotingInterval = null;
let gameEvents = []; // Track live game events for left wing
let revealTimeouts = [];
let headerFloating = false;

// Session token for auth (set on createRoom/joinRoom)
let sessionToken = null;
