/**
 * Shared type definitions for Oracle of Wit API.
 * Import types with: @import { Room, Player, Submission } from './types.js'
 */

/**
 * @typedef {Object} Player
 * @property {string} name
 * @property {number} score
 * @property {boolean} isHost
 * @property {boolean} isBot
 * @property {number} joinedAt
 */

/**
 * @typedef {Object} Submission
 * @property {number} id
 * @property {string} playerName
 * @property {string} punchline
 * @property {number} submittedAt
 */

/**
 * @typedef {Object} Bet
 * @property {string} playerName
 * @property {number} submissionId
 * @property {number} amount
 * @property {number} placedAt
 */

/**
 * @typedef {Object} RoundResult
 * @property {number} round
 * @property {number|null} winnerId
 * @property {string} winnerName
 * @property {string} winningPunchline
 * @property {string} judgingMethod
 * @property {boolean} [onChain]
 * @property {string|null} [txHash]
 * @property {Object|null} [aiCommentary]
 * @property {boolean} [glOverride]
 * @property {Object<string, number>} scores
 * @property {number[]} [revealOrder]
 * @property {number} [streak]
 * @property {boolean} [isComeback]
 * @property {Object<string, number>} [voteCounts]
 * @property {number} [totalVotes]
 * @property {boolean} [appealed]
 * @property {string} [appealResult]
 * @property {number|null} [appealNewWinnerId]
 * @property {string} [appealNewWinnerName]
 * @property {string} [appealNewPunchline]
 * @property {boolean} [appealOnChain]
 * @property {string|null} [appealTxHash]
 */

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} host
 * @property {string} category
 * @property {number} maxPlayers
 * @property {Player[]} players
 * @property {string[]} spectators
 * @property {string} status
 * @property {number} currentRound
 * @property {number} totalRounds
 * @property {string} jokePrompt
 * @property {Submission[]} submissions
 * @property {Bet[]} bets
 * @property {Object[]} reactions
 * @property {RoundResult[]} roundResults
 * @property {string[]} usedPrompts
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number|null} phaseEndsAt
 * @property {boolean} isSinglePlayer
 * @property {WeeklyTheme|null} weeklyTheme
 * @property {number} version
 * @property {Object<string, number>} [streaks]
 * @property {number[]|null} [curatedIds]
 * @property {Object<string, number>} [audienceVotes]
 * @property {string} [lastJudgingMethod]
 * @property {Object|null} [promptSource]
 * @property {Object<string, number>} [betBudgets]
 * @property {number} [roundStartedAt]
 */

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} name
 * @property {number} createdAt
 * @property {number} lifetimeXP
 * @property {number} level
 * @property {string} title
 * @property {number} gamesPlayed
 * @property {number} gamesWon
 * @property {number} roundsWon
 * @property {number} bestStreak
 * @property {number} totalCorrectBets
 * @property {string[]} achievements
 * @property {number} dailyChallengeStreak
 * @property {string|null} lastDailyDate
 * @property {number} lastPlayedAt
 */

/**
 * @typedef {Object} HandlerContext
 * @property {function(string): Promise<Room|null>} getRoomRaw
 * @property {function(string): Promise<Room|null>} getRoom
 * @property {function(string, Room): Promise<boolean>} setRoom
 * @property {function(): Promise<LeaderboardEntry[]>} getLeaderboard
 * @property {function(LeaderboardEntry[]): Promise<void>} setLeaderboard
 * @property {function(string, number, boolean): Promise<void>} updateLeaderboard
 * @property {function(string): string} sanitizeInput
 * @property {function(): string} generateRoomCode
 * @property {string[]} VALID_CATEGORIES
 * @property {string|undefined} GENLAYER_CONTRACT_ADDRESS
 * @property {Object} query
 */

/**
 * @typedef {Object} HandlerResult
 * @property {number} status
 * @property {Object} [data]
 * @property {string} [html]
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} name
 * @property {number} totalScore
 * @property {number} gamesPlayed
 * @property {number} [wins]
 */

/**
 * @typedef {Object} AIJudgment
 * @property {number|null} winnerId
 * @property {Object|null} aiCommentary
 * @property {string} [judgingMethod]
 */

/**
 * @typedef {Object} WeeklyTheme
 * @property {string} name
 * @property {string} emoji
 * @property {string} description
 * @property {string[]} bonusPrompts
 */

/**
 * @typedef {Object} LevelThreshold
 * @property {number} xp
 * @property {number} level
 * @property {string} title
 */

/**
 * @typedef {Object} Achievement
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 */

/**
 * @typedef {Object} CircuitState
 * @property {boolean} open
 * @property {number} openedAt
 */

/**
 * @typedef {Object} GenLayerSubmitResult
 * @property {string} txHash
 * @property {boolean} onChain
 */

/**
 * @typedef {Object} ShareData
 * @property {string} [winnerName]
 * @property {string} [punchline]
 * @property {string} [prompt]
 * @property {number} [score]
 * @property {string} [category]
 * @property {number} [createdAt]
 */

/**
 * @typedef {Object} CommunityPrompt
 * @property {string} id
 * @property {string} prompt
 * @property {string} author
 * @property {string} playerId
 * @property {number} votes
 * @property {string[]} voters
 * @property {string} status
 * @property {number} createdAt
 */

/**
 * @typedef {Object} Challenge
 * @property {string} creatorName
 * @property {number} creatorScore
 * @property {string} prompt
 * @property {string} category
 * @property {number} createdAt
 */

/**
 * @typedef {Object} HallOfFameEntry
 * @property {string} prompt
 * @property {string} punchline
 * @property {string} author
 * @property {string|null} commentary
 * @property {string} category
 * @property {number} date
 */

export {};
