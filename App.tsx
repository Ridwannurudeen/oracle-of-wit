/**
 * Oracle of Wit - Main App Entry Point
 * =====================================
 * 
 * Complete React application for the Oracle of Wit game.
 * 
 * Setup:
 *   npx create-vite oracle-of-wit-app --template react-ts
 *   cd oracle-of-wit-app
 *   npm install genlayer-js react-router-dom
 *   npm install -D @types/react-router-dom tailwindcss postcss autoprefixer
 *   npx tailwindcss init -p
 */

import React, { useState, useEffect, createContext, useContext } from 'react';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Update these after deployment
  CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000000',
  NETWORK: 'simulator', // 'simulator' | 'testnet'
  POLL_INTERVAL: 3000, // ms
};

// =============================================================================
// TYPES
// =============================================================================

export interface GameState {
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

export interface Submission {
  anonymous_id: number;
  text: string;
  author?: string;
}

export interface PlayerScore {
  address: string;
  total_xp: number;
  wins_as_author: number;
  correct_predictions: number;
  games_played: number;
}

export interface WalletState {
  address: string;
  balance: number;
  isConnected: boolean;
}

// =============================================================================
// CONTEXT
// =============================================================================

interface AppContextType {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// =============================================================================
// GENLAYER CLIENT
// =============================================================================

// In production, replace with actual GenLayerJS implementation
class GenLayerClient {
  private address: string = '';
  
  async connect(): Promise<string> {
    // In production:
    // import { createClient, createAccount } from 'genlayer-js';
    // const account = createAccount();
    // return account.address;
    
    // Mock for demo
    this.address = '0x' + Math.random().toString(16).slice(2, 42);
    return this.address;
  }
  
  getAddress(): string {
    return this.address;
  }
  
  async readContract(method: string, args: any[] = []): Promise<any> {
    console.log(`[READ] ${method}(${JSON.stringify(args)})`);
    
    // Mock responses for demo
    if (method === 'get_balance') {
      return Math.floor(Math.random() * 1000) + 100;
    }
    if (method === 'get_game_state') {
      return this.getMockGameState(args[0]);
    }
    if (method === 'get_player_score') {
      return {
        address: args[0],
        total_xp: Math.floor(Math.random() * 5000),
        wins_as_author: Math.floor(Math.random() * 10),
        correct_predictions: Math.floor(Math.random() * 20),
        games_played: Math.floor(Math.random() * 50),
      };
    }
    return null;
  }
  
  async writeContract(method: string, args: any[], value?: number): Promise<string> {
    console.log(`[WRITE] ${method}(${JSON.stringify(args)}) value=${value}`);
    
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return '0x' + Math.random().toString(16).slice(2, 66);
  }
  
  private getMockGameState(gameId: string): GameState {
    return {
      game_id: gameId,
      host: this.address,
      status: 'betting',
      joke_prompt: "An AI, a philosopher, and a cat walk into a bar. The bartender says 'We don't serve your kind here.' The AI replies...",
      players: [this.address, '0xabc...123', '0xdef...456'],
      player_count: 3,
      submission_count: 3,
      submissions: [
        { anonymous_id: 1, text: "That's fine, I'll just download a different bar." },
        { anonymous_id: 2, text: "I know. That's why I brought the philosopher to explain why you should, and the cat to ignore you anyway." },
        { anonymous_id: 3, text: "Error 418: I'm a teapot, not a customer." },
      ],
      bet_count: 2,
      prize_pool: 150,
      bet_min: 10,
      bet_max: 100,
      winning_submission_id: -1,
      winning_author: '',
    };
  }
}

const client = new GenLayerClient();

// =============================================================================
// HOOKS
// =============================================================================

export function useGameContract() {
  const depositXP = async (amount: number) => {
    return client.writeContract('deposit_xp', [], amount);
  };
  
  const withdrawXP = async (amount: number) => {
    return client.writeContract('withdraw_xp', [amount]);
  };
  
  const getBalance = async (player: string): Promise<number> => {
    return client.readContract('get_balance', [player]) as Promise<number>;
  };
  
  const createGame = async (
    minPlayers: number = 2,
    maxPlayers: number = 10,
    betMin: number = 10,
    betMax: number = 100
  ): Promise<string> => {
    await client.writeContract('create_game', [minPlayers, maxPlayers, betMin, betMax]);
    return `GAME_${Date.now()}`;
  };
  
  const joinGame = async (gameId: string) => {
    return client.writeContract('join_game', [gameId]);
  };
  
  const startGame = async (gameId: string) => {
    return client.writeContract('start_game', [gameId]);
  };
  
  const submitPunchline = async (gameId: string, punchline: string) => {
    return client.writeContract('submit_punchline', [gameId, punchline]);
  };
  
  const startBettingPhase = async (gameId: string) => {
    return client.writeContract('start_betting_phase', [gameId]);
  };
  
  const placeBet = async (gameId: string, submissionId: number, amount: number) => {
    return client.writeContract('place_bet', [gameId, submissionId, amount]);
  };
  
  const finalizeJudging = async (gameId: string) => {
    return client.writeContract('finalize_judging', [gameId]);
  };
  
  const getGameState = async (gameId: string): Promise<GameState | null> => {
    return client.readContract('get_game_state', [gameId]);
  };
  
  const getPlayerScore = async (player: string): Promise<PlayerScore | null> => {
    return client.readContract('get_player_score', [player]);
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
    getPlayerScore,
  };
}

export function useGameState(gameId: string | null) {
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contract = useGameContract();
  
  useEffect(() => {
    if (!gameId) {
      setGame(null);
      return;
    }
    
    const fetchState = async () => {
      try {
        const state = await contract.getGameState(gameId);
        setGame(state);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    
    fetchState();
    const interval = setInterval(fetchState, CONFIG.POLL_INTERVAL);
    
    return () => clearInterval(interval);
  }, [gameId]);
  
  return { game, loading, error };
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

// Animated background component
const AnimatedBackground: React.FC = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
    <div 
      className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse" 
      style={{ animationDelay: '1s' }} 
    />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
  </div>
);

// Loading spinner
const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={`${sizes[size]} border-2 border-purple-500 border-t-transparent rounded-full animate-spin`} />
  );
};

// Glass card component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => (
  <div 
    className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl ${className} ${onClick ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}`}
    onClick={onClick}
  >
    {children}
  </div>
);

// Button component
const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  loading?: boolean;
}> = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
    secondary: 'bg-slate-700 hover:bg-slate-600',
    success: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    warning: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]} ${sizes[size]}
        rounded-xl font-bold text-white transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        hover:scale-[1.02] active:scale-[0.98]
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
};

// Header component
const Header: React.FC<{
  wallet: WalletState;
  onConnect: () => void;
  onDisconnect: () => void;
}> = ({ wallet, onConnect, onDisconnect }) => (
  <header className="py-6 px-4">
    <div className="max-w-6xl mx-auto flex justify-between items-center">
      <div className="flex items-center gap-3">
        <span className="text-4xl animate-bounce">🎭</span>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            Oracle of Wit
          </h1>
          <p className="text-xs text-gray-400">Powered by GenLayer</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {wallet.isConnected ? (
          <>
            <GlassCard className="px-4 py-2">
              <span className="text-yellow-400 font-bold">{wallet.balance.toLocaleString()} XP</span>
            </GlassCard>
            <div 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold cursor-pointer hover:ring-2 ring-white/50 transition-all"
              onClick={onDisconnect}
              title="Disconnect"
            >
              {wallet.address.slice(2, 4).toUpperCase()}
            </div>
          </>
        ) : (
          <Button onClick={onConnect} size="sm">
            Connect Wallet
          </Button>
        )}
      </div>
    </div>
  </header>
);

// Phase indicator component
const PhaseIndicator: React.FC<{ status: GameState['status'] }> = ({ status }) => {
  const phases = ['waiting', 'submitting', 'betting', 'judging', 'finished'];
  const currentIndex = phases.indexOf(status);
  
  const labels = {
    waiting: '🎪 Waiting for Players',
    submitting: '✍️ Submission Phase',
    betting: '🎯 Betting Phase',
    judging: '🔮 AI Judging',
    finished: '🏆 Game Complete',
  };
  
  const colors = {
    waiting: 'text-yellow-400 bg-yellow-400',
    submitting: 'text-blue-400 bg-blue-400',
    betting: 'text-purple-400 bg-purple-400',
    judging: 'text-orange-400 bg-orange-400',
    finished: 'text-green-400 bg-green-400',
  };
  
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 ${colors[status].split(' ')[1]} rounded-full animate-pulse`} />
        <span className={`font-bold ${colors[status].split(' ')[0]}`}>
          {labels[status]}
        </span>
      </div>
      
      <div className="flex gap-1">
        {phases.map((phase, i) => (
          <div
            key={phase}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentIndex ? colors[status].split(' ')[1] : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Timer component
const Timer: React.FC<{ deadline?: number }> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  
  useEffect(() => {
    if (!deadline) return;
    
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, deadline - now);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  
  return (
    <div className="text-gray-400 font-mono">
      ⏱️ {timeLeft}
    </div>
  );
};

// Submission card component
const SubmissionCard: React.FC<{
  submission: Submission;
  selected?: boolean;
  onClick?: () => void;
  showAuthor?: boolean;
  isWinner?: boolean;
}> = ({ submission, selected, onClick, showAuthor, isWinner }) => (
  <div
    onClick={onClick}
    className={`
      p-4 rounded-xl transition-all
      ${selected 
        ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-2 border-purple-500 ring-4 ring-purple-500/20' 
        : 'bg-slate-800 hover:bg-slate-700 border-2 border-transparent hover:border-purple-500/50'}
      ${onClick ? 'cursor-pointer' : ''}
      ${isWinner ? 'ring-4 ring-yellow-500/50' : ''}
    `}
  >
    <div className="flex items-start gap-4">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl
        ${isWinner 
          ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
          : 'bg-gradient-to-br from-slate-600 to-slate-700'}
      `}>
        {isWinner ? '👑' : submission.anonymous_id}
      </div>
      <div className="flex-1">
        <p className="text-white">{submission.text}</p>
        {showAuthor && submission.author && (
          <p className="text-sm text-gray-400 mt-2 font-mono">
            By: {submission.author.slice(0, 10)}...
          </p>
        )}
        {selected && (
          <p className="text-purple-400 text-sm mt-2">✓ Your selection</p>
        )}
      </div>
    </div>
  </div>
);

// Oracle eye animation
const OracleEye: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-16 h-16 text-3xl',
    md: 'w-24 h-24 text-5xl',
    lg: 'w-32 h-32 text-6xl',
  };
  
  return (
    <div className={`
      ${sizes[size].split(' ').slice(0, 2).join(' ')}
      rounded-full flex items-center justify-center
      bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600
      shadow-lg shadow-purple-500/30 animate-pulse
    `}>
      <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
        <span className={`${sizes[size].split(' ')[2]} animate-bounce`}>👁️</span>
      </div>
    </div>
  );
};

// =============================================================================
// PAGE COMPONENTS
// =============================================================================

// Home/Lobby page
const HomePage: React.FC<{
  onCreateGame: () => void;
  onJoinGame: (gameId: string) => void;
}> = ({ onCreateGame, onJoinGame }) => {
  const [joinGameId, setJoinGameId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  
  return (
    <div className="max-w-lg mx-auto">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="mb-6 flex justify-center">
          <OracleEye size="lg" />
        </div>
        <h2 className="text-4xl font-bold mb-4">
          Can You Predict the{' '}
          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            AI's Humor?
          </span>
        </h2>
        <p className="text-gray-400">
          Write punchlines. Place bets. Let the Oracle decide.
        </p>
      </div>
      
      {/* Actions */}
      <div className="space-y-4">
        <Button 
          onClick={() => setShowCreate(true)} 
          variant="primary" 
          size="lg" 
          className="w-full"
        >
          🎮 Create New Game
        </Button>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value)}
            placeholder="Enter Game ID (e.g., GAME_1)"
            className="flex-1 px-4 py-3 bg-slate-800 rounded-xl text-white placeholder-gray-500 border border-slate-700 focus:border-purple-500 focus:outline-none"
          />
          <Button 
            onClick={() => onJoinGame(joinGameId)}
            disabled={!joinGameId}
            variant="secondary"
            size="lg"
          >
            Join
          </Button>
        </div>
      </div>
      
      {/* Create Game Modal */}
      {showCreate && (
        <CreateGameModal 
          onClose={() => setShowCreate(false)}
          onCreate={onCreateGame}
        />
      )}
    </div>
  );
};

// Create game modal
const CreateGameModal: React.FC<{
  onClose: () => void;
  onCreate: () => void;
}> = ({ onClose, onCreate }) => {
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [loading, setLoading] = useState(false);
  
  const handleCreate = async () => {
    setLoading(true);
    await onCreate();
    setLoading(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <GlassCard className="w-full max-w-md p-6">
        <h3 className="text-2xl font-bold mb-6">Create New Game</h3>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Min Players</label>
            <input
              type="number"
              min={2}
              max={10}
              value={minPlayers}
              onChange={(e) => setMinPlayers(Number(e.target.value))}
              className="w-full px-4 py-2 bg-slate-800 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Max Players</label>
            <input
              type="number"
              min={2}
              max={10}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full px-4 py-2 bg-slate-800 rounded-lg text-white"
            />
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading} className="flex-1">
            Create Game
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};

// Game page - orchestrates all phases
const GamePage: React.FC<{
  gameId: string;
  playerAddress: string;
  onLeave: () => void;
}> = ({ gameId, playerAddress, onLeave }) => {
  const { game, loading, error } = useGameState(gameId);
  const contract = useGameContract();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  
  if (loading && !game) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="text-gray-400 mt-4">Loading game...</p>
      </div>
    );
  }
  
  if (error || !game) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">Error loading game: {error}</p>
        <Button onClick={onLeave} variant="secondary">Back to Lobby</Button>
      </div>
    );
  }
  
  const isHost = game.host === playerAddress;
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">{game.game_id}</h2>
          <p className="text-sm text-gray-400">
            {game.player_count} players • Prize pool: {game.prize_pool} XP
          </p>
        </div>
        <Button onClick={onLeave} variant="secondary" size="sm">
          Leave
        </Button>
      </div>
      
      <PhaseIndicator status={game.status} />
      
      {/* Phase-specific content */}
      {game.status === 'waiting' && (
        <WaitingPhase 
          game={game} 
          isHost={isHost}
          onStart={() => contract.startGame(gameId)}
        />
      )}
      
      {game.status === 'submitting' && (
        <SubmittingPhase
          game={game}
          hasSubmitted={hasSubmitted}
          onSubmit={async (text) => {
            await contract.submitPunchline(gameId, text);
            setHasSubmitted(true);
          }}
          isHost={isHost}
          onStartBetting={() => contract.startBettingPhase(gameId)}
        />
      )}
      
      {game.status === 'betting' && (
        <BettingPhase
          game={game}
          hasBet={hasBet}
          onPlaceBet={async (subId, amount) => {
            await contract.placeBet(gameId, subId, amount);
            setHasBet(true);
          }}
          onFinalize={() => contract.finalizeJudging(gameId)}
        />
      )}
      
      {game.status === 'judging' && (
        <JudgingPhase />
      )}
      
      {game.status === 'finished' && (
        <FinishedPhase game={game} playerAddress={playerAddress} />
      )}
    </div>
  );
};

// Waiting phase component
const WaitingPhase: React.FC<{
  game: GameState;
  isHost: boolean;
  onStart: () => void;
}> = ({ game, isHost, onStart }) => (
  <GlassCard className="p-6">
    <h3 className="text-xl font-bold mb-4">👥 Players ({game.player_count})</h3>
    
    <div className="space-y-2 mb-6">
      {game.players.map((player, i) => (
        <div key={player} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
          <span className="text-xl">{i === 0 ? '👑' : '🎭'}</span>
          <span className="font-mono text-sm truncate flex-1">{player}</span>
          {i === 0 && <span className="text-xs bg-purple-500 px-2 py-1 rounded">HOST</span>}
        </div>
      ))}
    </div>
    
    {isHost ? (
      <Button 
        onClick={onStart}
        disabled={game.player_count < 2}
        variant="warning"
        size="lg"
        className="w-full"
      >
        {game.player_count < 2 ? 'Need more players' : '🚀 Start Game'}
      </Button>
    ) : (
      <p className="text-center text-gray-400">Waiting for host to start...</p>
    )}
  </GlassCard>
);

// Submitting phase component
const SubmittingPhase: React.FC<{
  game: GameState;
  hasSubmitted: boolean;
  onSubmit: (text: string) => Promise<void>;
  isHost: boolean;
  onStartBetting: () => void;
}> = ({ game, hasSubmitted, onSubmit, isHost, onStartBetting }) => {
  const [punchline, setPunchline] = useState('');
  const [loading, setLoading] = useState(false);
  const MAX_LENGTH = 200;
  
  const handleSubmit = async () => {
    if (!punchline.trim()) return;
    setLoading(true);
    await onSubmit(punchline);
    setLoading(false);
  };
  
  return (
    <GlassCard className="p-6">
      {/* Prompt */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl border border-purple-500/30">
        <p className="text-sm text-purple-300 mb-2">🤖 AI-Generated Prompt:</p>
        <p className="text-xl font-medium italic">"{game.joke_prompt}"</p>
      </div>
      
      {!hasSubmitted ? (
        <>
          <textarea
            value={punchline}
            onChange={(e) => setPunchline(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="Write your witty punchline..."
            className="w-full h-32 px-4 py-3 bg-slate-800 rounded-xl text-white placeholder-gray-500 resize-none mb-2"
          />
          <div className="flex justify-between text-sm mb-4">
            <span className="text-gray-400">Be creative!</span>
            <span className={punchline.length > MAX_LENGTH - 20 ? 'text-red-400' : 'text-gray-400'}>
              {punchline.length}/{MAX_LENGTH}
            </span>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={!punchline.trim()}
            loading={loading}
            variant="success"
            size="lg"
            className="w-full"
          >
            📤 Submit Punchline
          </Button>
        </>
      ) : (
        <div className="text-center p-6 bg-green-900/30 rounded-xl border border-green-500/30">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-green-400 font-bold">Submitted!</p>
          <p className="text-gray-400 text-sm mt-2">
            Waiting... ({game.submission_count}/{game.player_count})
          </p>
        </div>
      )}
      
      {isHost && game.submission_count >= 2 && (
        <Button onClick={onStartBetting} variant="secondary" className="w-full mt-4">
          Start Betting Phase
        </Button>
      )}
    </GlassCard>
  );
};

// Betting phase component
const BettingPhase: React.FC<{
  game: GameState;
  hasBet: boolean;
  onPlaceBet: (subId: number, amount: number) => Promise<void>;
  onFinalize: () => void;
}> = ({ game, hasBet, onPlaceBet, onFinalize }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState(game.bet_min);
  const [loading, setLoading] = useState(false);
  
  const handleBet = async () => {
    if (selectedId === null) return;
    setLoading(true);
    await onPlaceBet(selectedId, betAmount);
    setLoading(false);
  };
  
  return (
    <div className="space-y-6">
      {/* Prompt reminder */}
      <GlassCard className="p-4">
        <p className="text-sm text-gray-400">Prompt: "{game.joke_prompt}"</p>
      </GlassCard>
      
      {/* Submissions */}
      <div className="space-y-3">
        {game.submissions.map((sub) => (
          <SubmissionCard
            key={sub.anonymous_id}
            submission={sub}
            selected={selectedId === sub.anonymous_id}
            onClick={!hasBet ? () => setSelectedId(sub.anonymous_id) : undefined}
          />
        ))}
      </div>
      
      {/* Betting controls */}
      {!hasBet ? (
        <GlassCard className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-gray-400">Bet:</span>
            <input
              type="range"
              min={game.bet_min}
              max={game.bet_max}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-2xl font-bold text-yellow-400 w-24 text-right">
              {betAmount} XP
            </span>
          </div>
          <Button
            onClick={handleBet}
            disabled={selectedId === null}
            loading={loading}
            variant="warning"
            size="lg"
            className="w-full"
          >
            {selectedId ? `🎲 Bet on #${selectedId}` : 'Select a submission'}
          </Button>
        </GlassCard>
      ) : (
        <GlassCard className="p-6 text-center">
          <div className="text-4xl mb-2">🎲</div>
          <p className="text-purple-400 font-bold">Bet Placed!</p>
          <p className="text-gray-400 text-sm">
            Waiting... ({game.bet_count}/{game.player_count})
          </p>
        </GlassCard>
      )}
      
      {/* Finalize button */}
      {game.bet_count >= 2 && (
        <Button onClick={onFinalize} variant="primary" className="w-full">
          🔮 Finalize Judging
        </Button>
      )}
      
      {/* Prize pool */}
      <div className="text-center">
        <span className="text-gray-400">Prize Pool: </span>
        <span className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          {game.prize_pool} XP
        </span>
      </div>
    </div>
  );
};

// Judging phase component
const JudgingPhase: React.FC = () => (
  <GlassCard className="p-8 text-center">
    <div className="mb-6 flex justify-center">
      <OracleEye size="lg" />
    </div>
    <h3 className="text-2xl font-bold mb-4">The Oracle Deliberates...</h3>
    <p className="text-gray-400 mb-6">
      AI validators are reaching consensus on the funniest submission...
    </p>
    <div className="flex justify-center gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
    <p className="text-sm text-purple-400 mt-4">Optimistic Democracy in action 🗳️</p>
  </GlassCard>
);

// Finished phase component
const FinishedPhase: React.FC<{
  game: GameState;
  playerAddress: string;
}> = ({ game, playerAddress }) => {
  const winningSubmission = game.submissions.find(
    s => s.anonymous_id === game.winning_submission_id
  );
  const isWinner = game.winning_author === playerAddress;
  
  return (
    <div className="space-y-6">
      {/* Winner card */}
      <GlassCard className="p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50">
        <div className="text-center mb-4">
          <span className="text-6xl">👑</span>
        </div>
        <p className="text-sm text-yellow-400 text-center mb-2">
          The Oracle has spoken! #1 Funniest:
        </p>
        <p className="text-xl text-center font-medium mb-4">
          "{winningSubmission?.text}"
        </p>
        <p className="text-sm text-gray-400 text-center font-mono">
          By: {game.winning_author.slice(0, 16)}...
        </p>
      </GlassCard>
      
      {/* Personal result */}
      {isWinner && (
        <GlassCard className="p-4 bg-green-900/30 border-green-500/50 text-center">
          <p className="text-green-400 font-bold text-lg">🎉 You're the Wittiest!</p>
        </GlassCard>
      )}
      
      {/* All submissions */}
      <div className="space-y-3">
        <h4 className="font-bold">All Submissions:</h4>
        {game.submissions.map((sub) => (
          <SubmissionCard
            key={sub.anonymous_id}
            submission={sub}
            showAuthor
            isWinner={sub.anonymous_id === game.winning_submission_id}
          />
        ))}
      </div>
      
      {/* Prize pool */}
      <div className="text-center">
        <span className="text-gray-400">Total Distributed: </span>
        <span className="text-3xl font-bold text-yellow-400">{game.prize_pool} XP</span>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN APP
// =============================================================================

export const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: '',
    balance: 0,
    isConnected: false,
  });
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const contract = useGameContract();
  
  const connectWallet = async () => {
    try {
      const address = await client.connect();
      const balance = await contract.getBalance(address);
      setWallet({ address, balance, isConnected: true });
    } catch (e) {
      console.error('Failed to connect:', e);
    }
  };
  
  const disconnectWallet = () => {
    setWallet({ address: '', balance: 0, isConnected: false });
    setCurrentGameId(null);
  };
  
  const refreshBalance = async () => {
    if (!wallet.isConnected) return;
    const balance = await contract.getBalance(wallet.address);
    setWallet(prev => ({ ...prev, balance }));
  };
  
  const handleCreateGame = async () => {
    const gameId = await contract.createGame();
    setCurrentGameId(gameId);
  };
  
  const handleJoinGame = async (gameId: string) => {
    await contract.joinGame(gameId);
    setCurrentGameId(gameId);
  };
  
  return (
    <AppContext.Provider value={{ wallet, connectWallet, disconnectWallet, refreshBalance }}>
      <div className="min-h-screen bg-slate-900 text-white">
        <AnimatedBackground />
        
        <Header 
          wallet={wallet}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
        />
        
        <main className="px-4 py-8">
          {!wallet.isConnected ? (
            <div className="max-w-lg mx-auto text-center py-20">
              <OracleEye size="lg" />
              <h2 className="text-3xl font-bold mt-8 mb-4">Welcome to Oracle of Wit</h2>
              <p className="text-gray-400 mb-8">
                Connect your wallet to start playing the AI humor prediction game.
              </p>
              <Button onClick={connectWallet} size="lg">
                Connect Wallet
              </Button>
            </div>
          ) : currentGameId ? (
            <GamePage
              gameId={currentGameId}
              playerAddress={wallet.address}
              onLeave={() => setCurrentGameId(null)}
            />
          ) : (
            <HomePage
              onCreateGame={handleCreateGame}
              onJoinGame={handleJoinGame}
            />
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
};

export default App;
