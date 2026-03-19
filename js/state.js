// Oracle of Wit — Global State (ES Module)

/**
 * @typedef {Object} GameState
 * @property {string} screen - Current screen/phase name.
 * @property {string} playerName
 * @property {string|null} roomId
 * @property {Object|null} room - The current room data from the server.
 * @property {boolean} isHost
 * @property {number|null} selectedSubmission
 * @property {number} betAmount
 * @property {boolean} hasSubmitted
 * @property {boolean} hasBet
 * @property {string|null} error
 * @property {boolean} loading
 * @property {Object[]} leaderboard
 * @property {Object[]} publicRooms
 * @property {number} timeLeft
 * @property {string} punchlineText
 * @property {boolean} showHelp
 * @property {boolean} validatorVotingStarted
 * @property {number[]} validatorVotes
 * @property {boolean} consensusReached
 * @property {number|null} winningSubmissionId
 * @property {Object|null} currentWeeklyTheme
 * @property {string|null} revealPhase
 * @property {number} revealIndex
 * @property {number|null} revealTimer
 * @property {Object[]} revealedJokes
 * @property {number} sentReactions
 * @property {Object[]} floatingEmojis
 * @property {string|null} playerId
 * @property {Object|null} profile
 * @property {Object[]} allAchievements
 * @property {number|null} nextLevelXP
 * @property {Object|null} dailyChallenge
 * @property {Object|null} dailyResult
 * @property {boolean} dailySubmitting
 * @property {Object[]} hallOfFame
 * @property {boolean} showHallOfFame
 * @property {Object|null} challengeData
 * @property {Object|null} challengeResult
 * @property {boolean} appealInProgress
 * @property {Object|null} appealResult
 * @property {Object[]} communityPrompts
 * @property {boolean} showCommunityPrompts
 * @property {number|null} votedFor
 */

/** @type {GameState} */
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
    // Wallet authentication
    walletAddress: localStorage.getItem('walletAddress') || null,
    isWalletConnected: !!localStorage.getItem('walletAddress'),
    walletConnecting: false,
};

/** @type {number|null} */
export let pollInterval = null;
/** @param {number|null} val */
export function setPollInterval(val) { pollInterval = val; }

/** @type {number|null} */
export let timerRAF = null;
/** @param {number|null} val */
export function setTimerRAF(val) { timerRAF = val; }

/** @type {number} */
export let lastTimerSecond = -1;
/** @param {number} val */
export function setLastTimerSecond(val) { lastTimerSecond = val; }

/** @type {boolean} */
export let renderPending = false;
/** @param {boolean} val */
export function setRenderPending(val) { renderPending = val; }

/** @type {number} */
export let lastRenderTime = 0;
/** @param {number} val */
export function setLastRenderTime(val) { lastRenderTime = val; }

/** @type {number} Minimum ms between renders */
export const MIN_RENDER_INTERVAL = 100;

/** @type {number|null} */
export let validatorVotingInterval = null;
/** @param {number|null} val */
export function setValidatorVotingInterval(val) { validatorVotingInterval = val; }

/** @type {{type: string, text: string, time: number}[]} Track live game events for left wing */
export let gameEvents = [];

/** @type {number[]} */
export let revealTimeouts = [];
/** @param {number[]} val */
export function setRevealTimeouts(val) { revealTimeouts = val; }

/** @type {boolean} */
export let headerFloating = false;
/** @param {boolean} val */
export function setHeaderFloating(val) { headerFloating = val; }

// Session token for auth (set on createRoom/joinRoom)
/** @type {string|null} */
export let sessionToken = null;
/** @param {string|null} val */
export function setSessionToken(val) { sessionToken = val; }
