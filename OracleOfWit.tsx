/**
 * Oracle of Wit - React Frontend Components
 * ==========================================
 * 
 * A complete frontend sketch for the Oracle of Wit game.
 * Uses GenLayerJS for blockchain interactions.
 * 
 * To use this in a real project:
 * 1. npm create vite@latest oracle-of-wit -- --template react-ts
 * 2. npm install genlayer-js tailwindcss
 * 3. Copy these components into src/
 */

import React, { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface GameState {
  game_id: string;
  host: string;
  status: 'waiting' | 'submitting' | 'betting' | 'judging' | 'finished';
  joke_prompt: string;
  players: string[];
  player_count: number;
  submission_count: number;
  submissions: Submission[];
  bet_count: number;
  prize_pool: number;
  bet_min: number;
  bet_max: number;
  winning_submission_id: number;
  winning_author: string;
}

interface Submission {
  anonymous_id: number;
  text: string;
  author?: string; // Only revealed after game ends
}

interface PlayerScore {
  address: string;
  total_xp: number;
  wins_as_author: number;
  correct_predictions: number;
  games_played: number;
}

// =============================================================================
// GENLAYER CLIENT HOOK
// =============================================================================

// Mock implementation - replace with actual GenLayerJS in production
const useGenLayerClient = () => {
  // In production, use:
  // import { createClient, createAccount } from 'genlayer-js';
  // import { simulator } from 'genlayer-js/chains';
  
  const CONTRACT_ADDRESS = '0x...'; // Your deployed contract address
  
  const readContract = async (functionName: string, args: any[] = []) => {
    // const result = await client.readContract({
    //   address: CONTRACT_ADDRESS,
    //   functionName,
    //   args
    // });
    // return result;
    console.log(`Reading: ${functionName}`, args);
    return null;
  };
  
  const writeContract = async (functionName: string, args: any[], value?: number) => {
    // const hash = await client.writeContract({
    //   address: CONTRACT_ADDRESS,
    //   functionName,
    //   args,
    //   value
    // });
    // const receipt = await client.waitForTransactionReceipt({
    //   hash,
    //   status: 'FINALIZED'
    // });
    // return receipt;
    console.log(`Writing: ${functionName}`, args, value);
    return { hash: '0x...' };
  };
  
  return { readContract, writeContract };
};

// =============================================================================
// GAME CONTRACT HOOK
// =============================================================================

export const useGameContract = () => {
  const { readContract, writeContract } = useGenLayerClient();
  
  const depositXP = async (amount: number) => {
    return writeContract('deposit_xp', [], amount);
  };
  
  const withdrawXP = async (amount: number) => {
    return writeContract('withdraw_xp', [amount]);
  };
  
  const getBalance = async (player: string): Promise<number> => {
    const result = await readContract('get_balance', [player]);
    return result as number || 0;
  };
  
  const createGame = async (
    minPlayers: number = 2,
    maxPlayers: number = 10,
    betMin: number = 10,
    betMax: number = 100
  ): Promise<string> => {
    const result = await writeContract('create_game', [minPlayers, maxPlayers, betMin, betMax]);
    return 'GAME_1'; // Parse from receipt
  };
  
  const joinGame = async (gameId: string) => {
    return writeContract('join_game', [gameId]);
  };
  
  const startGame = async (gameId: string): Promise<string> => {
    const result = await writeContract('start_game', [gameId]);
    return ''; // Parse joke_prompt from receipt
  };
  
  const submitPunchline = async (gameId: string, punchline: string): Promise<number> => {
    const result = await writeContract('submit_punchline', [gameId, punchline]);
    return 1; // Parse anonymous_id from receipt
  };
  
  const startBettingPhase = async (gameId: string) => {
    return writeContract('start_betting_phase', [gameId]);
  };
  
  const placeBet = async (gameId: string, submissionId: number, amount: number) => {
    return writeContract('place_bet', [gameId, submissionId, amount]);
  };
  
  const finalizeJudging = async (gameId: string) => {
    return writeContract('finalize_judging', [gameId]);
  };
  
  const getGameState = async (gameId: string): Promise<GameState | null> => {
    return readContract('get_game_state', [gameId]) as Promise<GameState | null>;
  };
  
  const getPlayerScore = async (player: string): Promise<PlayerScore | null> => {
    return readContract('get_player_score', [player]) as Promise<PlayerScore | null>;
  };
  
  return {
    depositXP,
    withdrawXP,
    getBalance,
    createGame,
    joinGame,
    startGame,
    submitPunchline,
    startBettingPhase,
    placeBet,
    finalizeJudging,
    getGameState,
    getPlayerScore
  };
};

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * XP Wallet Component
 * Manages player's XP balance
 */
export const XPWallet: React.FC<{
  playerAddress: string;
}> = ({ playerAddress }) => {
  const [balance, setBalance] = useState(0);
  const [depositAmount, setDepositAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [loading, setLoading] = useState(false);
  
  const { depositXP, withdrawXP, getBalance } = useGameContract();
  
  const refreshBalance = useCallback(async () => {
    const bal = await getBalance(playerAddress);
    setBalance(bal);
  }, [playerAddress, getBalance]);
  
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);
  
  const handleDeposit = async () => {
    setLoading(true);
    try {
      await depositXP(Number(depositAmount));
      await refreshBalance();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  const handleWithdraw = async () => {
    setLoading(true);
    try {
      await withdrawXP(Number(withdrawAmount));
      await refreshBalance();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  return (
    <div className="xp-wallet p-4 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl">
      <h3 className="text-xl font-bold text-white mb-2">💰 XP Wallet</h3>
      <div className="text-3xl font-bold text-yellow-400 mb-4">
        {balance.toLocaleString()} XP
      </div>
      
      <div className="flex gap-2 mb-2">
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          className="flex-1 px-3 py-2 bg-white/10 rounded text-white"
          placeholder="Amount"
        />
        <button
          onClick={handleDeposit}
          disabled={loading}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded font-bold"
        >
          Deposit
        </button>
      </div>
      
      <div className="flex gap-2">
        <input
          type="number"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          className="flex-1 px-3 py-2 bg-white/10 rounded text-white"
          placeholder="Amount"
        />
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded font-bold"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
};

/**
 * Game Lobby Component
 * Create or join games
 */
export const GameLobby: React.FC<{
  onGameJoined: (gameId: string) => void;
}> = ({ onGameJoined }) => {
  const [joinGameId, setJoinGameId] = useState('');
  const [minPlayers, setMinPlayers] = useState(4);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [loading, setLoading] = useState(false);
  
  const { createGame, joinGame } = useGameContract();
  
  const handleCreate = async () => {
    setLoading(true);
    try {
      const gameId = await createGame(minPlayers, maxPlayers);
      onGameJoined(gameId);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  const handleJoin = async () => {
    if (!joinGameId) return;
    setLoading(true);
    try {
      await joinGame(joinGameId);
      onGameJoined(joinGameId);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  return (
    <div className="game-lobby max-w-md mx-auto p-6 bg-slate-800 rounded-2xl">
      <h2 className="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
        🎭 Oracle of Wit
      </h2>
      
      {/* Create Game Section */}
      <div className="mb-8 p-4 bg-slate-700 rounded-xl">
        <h3 className="text-xl font-bold text-white mb-4">Create New Game</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-400">Min Players</label>
            <input
              type="number"
              min={2}
              max={10}
              value={minPlayers}
              onChange={(e) => setMinPlayers(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-600 rounded text-white"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Max Players</label>
            <input
              type="number"
              min={2}
              max={10}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-600 rounded text-white"
            />
          </div>
        </div>
        
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg font-bold text-white transition-all"
        >
          {loading ? '⏳ Creating...' : '🎮 Create Game'}
        </button>
      </div>
      
      {/* Join Game Section */}
      <div className="p-4 bg-slate-700 rounded-xl">
        <h3 className="text-xl font-bold text-white mb-4">Join Existing Game</h3>
        
        <input
          type="text"
          value={joinGameId}
          onChange={(e) => setJoinGameId(e.target.value)}
          placeholder="Enter Game ID (e.g., GAME_1)"
          className="w-full px-3 py-2 bg-slate-600 rounded text-white mb-4"
        />
        
        <button
          onClick={handleJoin}
          disabled={loading || !joinGameId}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 rounded-lg font-bold text-white transition-all disabled:opacity-50"
        >
          {loading ? '⏳ Joining...' : '🚪 Join Game'}
        </button>
      </div>
    </div>
  );
};

/**
 * Waiting Room Component
 * Shows players and allows host to start
 */
export const WaitingRoom: React.FC<{
  game: GameState;
  isHost: boolean;
  onStartGame: () => void;
}> = ({ game, isHost, onStartGame }) => {
  return (
    <div className="waiting-room max-w-md mx-auto p-6 bg-slate-800 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-2">
        🎪 {game.game_id}
      </h2>
      <p className="text-gray-400 mb-6">Waiting for players...</p>
      
      {/* Player List */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3">
          Players ({game.player_count}/{10})
        </h3>
        <div className="space-y-2">
          {game.players.map((player, i) => (
            <div
              key={player}
              className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg"
            >
              <span className="text-2xl">
                {i === 0 ? '👑' : '🎭'}
              </span>
              <span className="text-white font-mono text-sm truncate">
                {player}
              </span>
              {i === 0 && (
                <span className="ml-auto text-xs bg-purple-500 px-2 py-1 rounded">
                  HOST
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Start Button (Host Only) */}
      {isHost && (
        <button
          onClick={onStartGame}
          disabled={game.player_count < 2}
          className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-xl font-bold text-xl text-white transition-all disabled:opacity-50"
        >
          {game.player_count < 2 
            ? `Need ${2 - game.player_count} more player(s)` 
            : '🚀 Start Game!'}
        </button>
      )}
      
      {!isHost && (
        <div className="text-center text-gray-400 py-4">
          Waiting for host to start the game...
        </div>
      )}
    </div>
  );
};

/**
 * Submission Phase Component
 * Shows joke prompt and submission form
 */
export const SubmissionPhase: React.FC<{
  game: GameState;
  onSubmit: (punchline: string) => Promise<void>;
  hasSubmitted: boolean;
}> = ({ game, onSubmit, hasSubmitted }) => {
  const [punchline, setPunchline] = useState('');
  const [loading, setLoading] = useState(false);
  const MAX_LENGTH = 200;
  
  const handleSubmit = async () => {
    if (!punchline.trim() || punchline.length > MAX_LENGTH) return;
    setLoading(true);
    try {
      await onSubmit(punchline);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  return (
    <div className="submission-phase max-w-lg mx-auto p-6 bg-slate-800 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-2">
        ✍️ Write Your Punchline
      </h2>
      
      {/* Joke Prompt */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl border border-purple-500/30">
        <p className="text-sm text-purple-300 mb-2">AI Generated Prompt:</p>
        <p className="text-xl text-white font-medium italic">
          "{game.joke_prompt}"
        </p>
      </div>
      
      {/* Submission Form */}
      {!hasSubmitted ? (
        <>
          <div className="mb-4">
            <textarea
              value={punchline}
              onChange={(e) => setPunchline(e.target.value)}
              maxLength={MAX_LENGTH}
              placeholder="Type your witty punchline here..."
              className="w-full h-32 px-4 py-3 bg-slate-700 rounded-xl text-white placeholder-gray-400 resize-none"
            />
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Be creative and funny!</span>
              <span className={punchline.length > MAX_LENGTH - 20 ? 'text-red-400' : 'text-gray-400'}>
                {punchline.length}/{MAX_LENGTH}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading || !punchline.trim()}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl font-bold text-white transition-all disabled:opacity-50"
          >
            {loading ? '⏳ Submitting...' : '📤 Submit Punchline'}
          </button>
        </>
      ) : (
        <div className="text-center p-6 bg-green-900/30 rounded-xl border border-green-500/30">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-green-400 font-bold">Submission Received!</p>
          <p className="text-gray-400 text-sm mt-2">
            Waiting for other players... ({game.submission_count}/{game.player_count})
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Betting Phase Component
 * Shows anonymous submissions and betting UI
 */
export const BettingPhase: React.FC<{
  game: GameState;
  onPlaceBet: (submissionId: number, amount: number) => Promise<void>;
  hasBet: boolean;
  playerBalance: number;
}> = ({ game, onPlaceBet, hasBet, playerBalance }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState(game.bet_min);
  const [loading, setLoading] = useState(false);
  
  const handleBet = async () => {
    if (selectedId === null) return;
    setLoading(true);
    try {
      await onPlaceBet(selectedId, betAmount);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  return (
    <div className="betting-phase max-w-2xl mx-auto p-6 bg-slate-800 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-2">
        🎯 Place Your Bet
      </h2>
      <p className="text-gray-400 mb-6">
        Which punchline will the AI Oracle rank #1?
      </p>
      
      {/* Reminder of prompt */}
      <div className="mb-6 p-3 bg-slate-700 rounded-lg">
        <p className="text-sm text-gray-400">Prompt: "{game.joke_prompt}"</p>
      </div>
      
      {/* Submissions Grid */}
      <div className="grid gap-3 mb-6">
        {game.submissions.map((sub) => (
          <div
            key={sub.anonymous_id}
            onClick={() => !hasBet && setSelectedId(sub.anonymous_id)}
            className={`
              p-4 rounded-xl cursor-pointer transition-all
              ${selectedId === sub.anonymous_id 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 ring-2 ring-white' 
                : 'bg-slate-700 hover:bg-slate-600'}
              ${hasBet ? 'cursor-not-allowed opacity-70' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-600 rounded-full font-bold text-white">
                {sub.anonymous_id}
              </span>
              <p className="text-white">{sub.text}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Betting Controls */}
      {!hasBet ? (
        <div className="p-4 bg-slate-700 rounded-xl">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-gray-400">Bet Amount:</span>
            <input
              type="range"
              min={game.bet_min}
              max={Math.min(game.bet_max, playerBalance)}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xl font-bold text-yellow-400 w-20 text-right">
              {betAmount} XP
            </span>
          </div>
          
          <button
            onClick={handleBet}
            disabled={loading || selectedId === null}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-xl font-bold text-white transition-all disabled:opacity-50"
          >
            {loading 
              ? '⏳ Placing Bet...' 
              : selectedId 
                ? `🎲 Bet ${betAmount} XP on #${selectedId}` 
                : 'Select a submission first'}
          </button>
        </div>
      ) : (
        <div className="text-center p-6 bg-blue-900/30 rounded-xl border border-blue-500/30">
          <div className="text-4xl mb-2">🎲</div>
          <p className="text-blue-400 font-bold">Bet Placed!</p>
          <p className="text-gray-400 text-sm mt-2">
            Waiting for other bets... ({game.bet_count}/{game.player_count})
          </p>
        </div>
      )}
      
      {/* Prize Pool */}
      <div className="mt-4 text-center">
        <span className="text-gray-400">Current Prize Pool: </span>
        <span className="text-2xl font-bold text-yellow-400">
          {game.prize_pool} XP
        </span>
      </div>
    </div>
  );
};

/**
 * Judging Phase Component
 * Shows consensus animation
 */
export const JudgingPhase: React.FC<{
  game: GameState;
}> = ({ game }) => {
  return (
    <div className="judging-phase max-w-md mx-auto p-6 bg-slate-800 rounded-2xl text-center">
      <h2 className="text-2xl font-bold text-white mb-6">
        🔮 The Oracle Deliberates...
      </h2>
      
      {/* Animated Oracle Eye */}
      <div className="relative w-32 h-32 mx-auto mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse" />
        <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
          <span className="text-5xl animate-bounce">👁️</span>
        </div>
      </div>
      
      <p className="text-gray-400 mb-4">
        AI validators are reaching consensus on the funniest submission...
      </p>
      
      {/* Validator Progress */}
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((v) => (
          <div
            key={v}
            className="w-4 h-4 bg-purple-500 rounded-full animate-pulse"
            style={{ animationDelay: `${v * 0.2}s` }}
          />
        ))}
      </div>
      
      <p className="text-sm text-purple-400">
        Optimistic Democracy in action 🗳️
      </p>
    </div>
  );
};

/**
 * Results Component
 * Shows winner and payouts
 */
export const Results: React.FC<{
  game: GameState;
  playerAddress: string;
}> = ({ game, playerAddress }) => {
  const winningSubmission = game.submissions.find(
    s => s.anonymous_id === game.winning_submission_id
  );
  
  const isWinningAuthor = game.winning_author === playerAddress;
  
  return (
    <div className="results max-w-lg mx-auto p-6 bg-slate-800 rounded-2xl">
      <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6">
        🏆 Results
      </h2>
      
      {/* Winner Card */}
      <div className="mb-6 p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border-2 border-yellow-500/50">
        <div className="text-center mb-3">
          <span className="text-5xl">👑</span>
        </div>
        <p className="text-sm text-yellow-400 text-center mb-2">
          The Oracle has spoken! #1 Funniest:
        </p>
        <p className="text-xl text-white text-center font-medium mb-4">
          "{winningSubmission?.text}"
        </p>
        <p className="text-sm text-gray-400 text-center">
          By: {game.winning_author.slice(0, 10)}...
        </p>
      </div>
      
      {/* Personal Result */}
      {isWinningAuthor && (
        <div className="mb-4 p-4 bg-green-900/30 rounded-xl border border-green-500/30 text-center">
          <p className="text-green-400 font-bold text-lg">🎉 You're the Wittiest!</p>
          <p className="text-gray-400">Your submission won!</p>
        </div>
      )}
      
      {/* All Submissions Ranked */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3">All Submissions:</h3>
        <div className="space-y-2">
          {game.submissions.map((sub, index) => (
            <div
              key={sub.anonymous_id}
              className={`p-3 rounded-lg ${
                sub.anonymous_id === game.winning_submission_id
                  ? 'bg-yellow-500/20 border border-yellow-500/50'
                  : 'bg-slate-700'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {sub.anonymous_id === game.winning_submission_id ? '🥇' : `#${sub.anonymous_id}`}
                </span>
                <div>
                  <p className="text-white text-sm">{sub.text}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Author: {sub.author?.slice(0, 8)}...
                    {sub.author === playerAddress && ' (you)'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Prize Pool Distribution */}
      <div className="text-center p-4 bg-slate-700 rounded-xl">
        <p className="text-gray-400">Total Prize Pool:</p>
        <p className="text-3xl font-bold text-yellow-400">
          {game.prize_pool} XP
        </p>
      </div>
    </div>
  );
};

/**
 * Leaderboard Component
 */
export const Leaderboard: React.FC<{
  scores: PlayerScore[];
}> = ({ scores }) => {
  const [tab, setTab] = useState<'wittiest' | 'oracles'>('wittiest');
  
  const sortedByWits = [...scores].sort((a, b) => b.wins_as_author - a.wins_as_author);
  const sortedByPredictions = [...scores].sort((a, b) => b.correct_predictions - a.correct_predictions);
  
  const displayList = tab === 'wittiest' ? sortedByWits : sortedByPredictions;
  
  return (
    <div className="leaderboard max-w-md mx-auto p-6 bg-slate-800 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-4">
        🏆 Leaderboard
      </h2>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('wittiest')}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${
            tab === 'wittiest'
              ? 'bg-purple-500 text-white'
              : 'bg-slate-700 text-gray-400'
          }`}
        >
          😂 Wittiest
        </button>
        <button
          onClick={() => setTab('oracles')}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${
            tab === 'oracles'
              ? 'bg-blue-500 text-white'
              : 'bg-slate-700 text-gray-400'
          }`}
        >
          🔮 Best Oracles
        </button>
      </div>
      
      {/* Leaderboard List */}
      <div className="space-y-2">
        {displayList.slice(0, 10).map((score, index) => (
          <div
            key={score.address}
            className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg"
          >
            <span className="text-2xl w-8 text-center">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-mono text-sm truncate">
                {score.address}
              </p>
              <p className="text-xs text-gray-400">
                {score.games_played} games played
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-yellow-400">
                {tab === 'wittiest' ? score.wins_as_author : score.correct_predictions}
              </p>
              <p className="text-xs text-gray-400">
                {tab === 'wittiest' ? 'wins' : 'correct'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Main Game Component
 * Orchestrates the entire game flow
 */
export const OracleOfWitGame: React.FC<{
  playerAddress: string;
}> = ({ playerAddress }) => {
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [playerBalance, setPlayerBalance] = useState(0);
  
  const contract = useGameContract();
  
  // Poll game state
  useEffect(() => {
    if (!currentGameId) return;
    
    const pollState = async () => {
      const state = await contract.getGameState(currentGameId);
      if (state) {
        setGame(state);
      }
    };
    
    pollState();
    const interval = setInterval(pollState, 3000);
    
    return () => clearInterval(interval);
  }, [currentGameId]);
  
  // Render based on game status
  if (!currentGameId || !game) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="mb-6">
          <XPWallet playerAddress={playerAddress} />
        </div>
        <GameLobby onGameJoined={setCurrentGameId} />
      </div>
    );
  }
  
  const isHost = game.host === playerAddress;
  
  return (
    <div className="min-h-screen bg-slate-900 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">{game.game_id}</h1>
          <span className={`text-sm px-2 py-1 rounded ${
            game.status === 'waiting' ? 'bg-yellow-500' :
            game.status === 'submitting' ? 'bg-blue-500' :
            game.status === 'betting' ? 'bg-purple-500' :
            game.status === 'judging' ? 'bg-orange-500' :
            'bg-green-500'
          }`}>
            {game.status.toUpperCase()}
          </span>
        </div>
        <button
          onClick={() => {
            setCurrentGameId(null);
            setGame(null);
            setHasSubmitted(false);
            setHasBet(false);
          }}
          className="text-gray-400 hover:text-white"
        >
          Leave Game
        </button>
      </div>
      
      {/* Game Phase Component */}
      {game.status === 'waiting' && (
        <WaitingRoom
          game={game}
          isHost={isHost}
          onStartGame={async () => {
            await contract.startGame(game.game_id);
          }}
        />
      )}
      
      {game.status === 'submitting' && (
        <SubmissionPhase
          game={game}
          hasSubmitted={hasSubmitted}
          onSubmit={async (punchline) => {
            await contract.submitPunchline(game.game_id, punchline);
            setHasSubmitted(true);
          }}
        />
      )}
      
      {game.status === 'betting' && (
        <BettingPhase
          game={game}
          hasBet={hasBet}
          playerBalance={playerBalance}
          onPlaceBet={async (submissionId, amount) => {
            await contract.placeBet(game.game_id, submissionId, amount);
            setHasBet(true);
          }}
        />
      )}
      
      {game.status === 'judging' && (
        <JudgingPhase game={game} />
      )}
      
      {game.status === 'finished' && (
        <Results game={game} playerAddress={playerAddress} />
      )}
      
      {/* Phase Transition Buttons (for host/debugging) */}
      {isHost && game.status === 'submitting' && game.submission_count >= 2 && (
        <div className="max-w-lg mx-auto mt-4">
          <button
            onClick={() => contract.startBettingPhase(game.game_id)}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
          >
            Start Betting Phase (Host)
          </button>
        </div>
      )}
      
      {game.status === 'betting' && game.bet_count >= 2 && (
        <div className="max-w-lg mx-auto mt-4">
          <button
            onClick={() => contract.finalizeJudging(game.game_id)}
            className="w-full py-2 bg-orange-600 hover:bg-orange-700 rounded text-white"
          >
            Finalize Judging
          </button>
        </div>
      )}
    </div>
  );
};

// Export default for easy importing
export default OracleOfWitGame;
