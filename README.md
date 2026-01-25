# Oracle of Wit - GenLayer Intelligent Contract

A multiplayer AI humor prediction game that showcases GenLayer's unique capabilities: **subjective AI judgment with decentralized consensus**.

## 🎮 Game Overview

**Oracle of Wit** is a prediction game where players bet XP on their ability to predict AI's sense of humor.

### Game Flow (8-12 minutes per round)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   1. WAITING    │───▶│  2. SUBMITTING  │───▶│   3. BETTING    │
│  Create/Join    │    │  Write punchlines│    │  Predict winner │
│  (2-10 players) │    │  (3-5 minutes)   │    │  (2-3 minutes)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
        ┌─────────────────────────────────────────────┘
        ▼
┌─────────────────┐    ┌─────────────────┐
│   4. JUDGING    │───▶│   5. FINISHED   │
│  AI ranks subs  │    │  Rewards paid   │
│  (Consensus)    │    │  Leaderboards   │
└─────────────────┘    └─────────────────┘
```

### Detailed Rules

1. **Room Creation**: Host creates a game room with bet limits
2. **Joining**: 4-10 players join (2+ for testing)
3. **Start**: Host starts game → AI generates a funny joke setup
4. **Submit Phase**: Each player writes a punchline (≤200 chars)
5. **Reveal & Bet**: Submissions shown with anonymous IDs; players bet XP on predicted winner
6. **AI Judging**: LLM ranks all submissions by humor/creativity via Optimistic Democracy
7. **Payout**:
   - Winning author receives bonus from pool
   - Correct predictors get their stake back + share of pool
   - Incorrect predictors lose their stake

---

## 🔮 Why This Showcases GenLayer

### Core Innovation: Subjective AI Consensus

Traditional blockchains can only handle deterministic operations. GenLayer's **Optimistic Democracy** allows:

```python
# NON-DETERMINISTIC: Different validators may get different LLM outputs
# CONSENSUS: Validators agree on "equivalent" results via the Equivalence Principle

ranking = gl.eq_principle_prompt_comparative(
    rank_function,
    "Both rankings should identify the same submission as funniest (#1)"
)
```

### Two Key LLM Operations

1. **Joke Generation** (`eq_principle_prompt_non_comparative`)
   - Creative content generation
   - Validators check output meets quality criteria
   - Different prompts are valid if they meet the criteria

2. **Humor Ranking** (`eq_principle_prompt_comparative`)
   - Subjective judgment requiring consensus
   - Validators independently rank submissions
   - Agreement on #1 position is the key criterion

---

## 📜 Contract Architecture

### Data Structures

```python
@allow_storage
@dataclass
class GameRoom:
    game_id: str
    status: str           # "waiting" | "submitting" | "betting" | "judging" | "finished"
    joke_prompt: str      # AI-generated setup
    prize_pool: u256      # Total XP wagered
    winning_submission_id: i32
    winning_author: str
    # ... more fields

@allow_storage
@dataclass
class Submission:
    author: str           # Hidden until game ends
    text: str             # The punchline
    anonymous_id: i32     # Public ID during betting

@allow_storage  
@dataclass
class Bet:
    player: str
    submission_id: i32    # Which anonymous_id they bet on
    amount: u256          # XP wagered
```

### Key Functions

| Function | Type | Description |
|----------|------|-------------|
| `deposit_xp()` | payable | Add XP to your balance |
| `create_game()` | write | Create a new game room |
| `join_game(game_id)` | write | Join an existing room |
| `start_game(game_id)` | write | Start game (host only) → generates AI prompt |
| `submit_punchline(game_id, text)` | write | Submit your punchline |
| `start_betting_phase(game_id)` | write | Transition to betting |
| `place_bet(game_id, sub_id, amount)` | write | Bet on a submission |
| `finalize_judging(game_id)` | write | AI ranks & distributes rewards |
| `get_game_state(game_id)` | view | Get complete game state |
| `get_balance(player)` | view | Check XP balance |
| `get_player_score(player)` | view | Get leaderboard stats |

---

## 🤖 LLM Prompts

### Prompt 1: Joke Setup Generation

```
You are a comedy writer for a multiplayer game. Generate ONE fresh, 
funny open-ended joke setup that players will complete with punchlines.

Requirements:
- The setup should be 1-3 sentences
- It should naturally lead to a punchline
- Be creative - avoid clichés
- The format should invite witty completions
- Keep it family-friendly but clever

Example formats:
- "An AI, a philosopher, and a cat walk into a bar. The bartender says..."
- "Scientists discovered that the meaning of life is actually..."
- "The first words spoken by a sentient toaster were..."

Respond with ONLY the joke setup text, nothing else.
```

**Equivalence Criteria**: Output must be a coherent 1-3 sentence joke setup, open-ended, creative, and family-friendly.

### Prompt 2: Humor Ranking

```
You are judging a comedy competition. Players submitted punchlines 
to complete this joke setup:

JOKE SETUP: "{joke_prompt}"

SUBMISSIONS:
ID 1: "punchline text..."
ID 2: "punchline text..."
...

Rank ALL submissions from FUNNIEST (#1) to least funny. Consider:
- Wit and cleverness
- Surprise/unexpected humor
- How well it fits the setup
- Creativity and originality

Respond with ONLY a JSON array of submission IDs in order from 
funniest to least funny.

Example: [3, 1, 5, 2, 4]
```

**Equivalence Principle**: "Both rankings should identify the same submission as funniest (#1). The top-ranked submission must be the same, though minor differences in lower ranks are acceptable."

---

## 🎨 Frontend Sketch (React + GenLayerJS)

### Component Structure

```
src/
├── App.tsx                 # Main router
├── components/
│   ├── GameLobby.tsx      # Create/join games
│   ├── WaitingRoom.tsx    # Player list, start button
│   ├── SubmissionPhase.tsx # Show prompt, submit form
│   ├── BettingPhase.tsx   # Anonymous reveals, bet UI
│   ├── JudgingPhase.tsx   # Loading/consensus animation
│   ├── Results.tsx        # Winner reveal, payouts
│   ├── Leaderboard.tsx    # Global stats
│   └── XPWallet.tsx       # Balance management
├── hooks/
│   ├── useGameContract.ts # Contract interactions
│   └── useGameState.ts    # Polling/websocket state
└── lib/
    └── genlayer.ts        # GenLayerJS client setup
```

### Key React Components

```tsx
// hooks/useGameContract.ts
import { createClient, createAccount } from 'genlayer-js';
import { simulator } from 'genlayer-js/chains';

export function useGameContract() {
  const client = createClient({
    chain: simulator, // or testnet/mainnet
    account: createAccount(privateKey)
  });

  const createGame = async (minPlayers: number, maxPlayers: number) => {
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'create_game',
      args: [minPlayers, maxPlayers, 10, 100]
    });
    return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
  };

  const submitPunchline = async (gameId: string, text: string) => {
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'submit_punchline',
      args: [gameId, text]
    });
    return client.waitForTransactionReceipt({ hash, status: 'FINALIZED' });
  };

  // ... more functions
}

// components/BettingPhase.tsx
function BettingPhase({ gameId, submissions }) {
  const [selectedId, setSelectedId] = useState(null);
  const [betAmount, setBetAmount] = useState(20);
  const { placeBet } = useGameContract();

  return (
    <div className="betting-phase">
      <h2>🎯 Place Your Bet</h2>
      <p>Which punchline will the AI rank #1?</p>
      
      <div className="submissions-grid">
        {submissions.map(sub => (
          <div 
            key={sub.id}
            className={`submission-card ${selectedId === sub.id ? 'selected' : ''}`}
            onClick={() => setSelectedId(sub.id)}
          >
            <span className="id-badge">#{sub.id}</span>
            <p>{sub.text}</p>
          </div>
        ))}
      </div>

      <div className="bet-controls">
        <input 
          type="range" 
          min={10} max={100} 
          value={betAmount}
          onChange={e => setBetAmount(Number(e.target.value))}
        />
        <span>{betAmount} XP</span>
        <button 
          onClick={() => placeBet(gameId, selectedId, betAmount)}
          disabled={!selectedId}
        >
          Confirm Bet
        </button>
      </div>
    </div>
  );
}
```

### UI/UX Features

- **Real-time updates**: Poll `get_game_state()` or use WebSocket for state changes
- **Phase timers**: Visual countdown for submission/betting phases
- **Anonymous reveal animation**: Shuffle effect when showing submissions
- **Consensus visualization**: Show validator agreement during judging
- **Confetti on win**: Celebrate correct predictions and winning authors
- **Leaderboard tabs**: "Wittiest Authors" vs "Best Oracles (Predictors)"

---

## 🚀 Deployment & Testing

### Prerequisites

1. Install GenLayer CLI:
```bash
npm install -g genlayer
```

2. Initialize local environment:
```bash
genlayer init
```

3. Start the simulator:
```bash
genlayer up
```

### Deploy to Simulator

```bash
# Deploy the contract
genlayer deploy --contract oracle_of_wit.py

# Or use a deploy script
```

### Testing in GenLayer Studio

1. Open http://localhost:8080 after running `genlayer up`
2. Load `oracle_of_wit.py` in the code editor
3. Deploy with no constructor args (click Deploy)
4. Create test accounts in the Accounts panel

**Test Flow**:

```
1. Account A: deposit_xp() with value 1000
2. Account A: create_game(2, 10, 10, 100) → returns "GAME_1"
3. Account B: deposit_xp() with value 1000
4. Account B: join_game("GAME_1")
5. Account A: start_game("GAME_1") → AI generates prompt
6. Account A: submit_punchline("GAME_1", "First punchline!")
7. Account B: submit_punchline("GAME_1", "Second punchline!")
8. Account A: start_betting_phase("GAME_1")
9. Account A: place_bet("GAME_1", 1, 50)
10. Account B: place_bet("GAME_1", 2, 50)
11. Anyone: finalize_judging("GAME_1") → AI ranks, rewards distributed
12. get_game_state("GAME_1") → see winner, payouts
```

### Deploy to Testnet

```bash
# Configure for testnet
genlayer config --network testnet

# Deploy
genlayer deploy --contract oracle_of_wit.py --network testnet
```

---

## 🔒 Security Considerations

1. **Phase Validation**: All functions check `game.status` before executing
2. **Balance Checks**: Bets require sufficient XP balance
3. **Duplicate Prevention**: Players can only submit/bet once per game
4. **Player Verification**: Actions restricted to game participants
5. **No Reentrancy**: State updated before external calls
6. **Owner Controls**: Only owner can modify configuration

---

## 📊 XP Economics

| Event | XP Change |
|-------|-----------|
| Correct prediction | +stake + (70% pool share proportional to bet) |
| Incorrect prediction | -stake |
| Winning author | +30% of pool (or 100% if no correct predictions) |

**Example** (100 XP pool, 3 bettors):
- Player A bets 30 XP on ID 1 ✓
- Player B bets 40 XP on ID 2 ✗  
- Player C bets 30 XP on ID 1 ✓
- ID 1 wins → Author gets 30 XP
- Predictors pool: 70 XP
- Player A receives: 30 + (70 × 30/60) = 30 + 35 = 65 XP
- Player C receives: 30 + (70 × 30/60) = 30 + 35 = 65 XP
- Player B loses 40 XP

---

## 🏆 Leaderboard System

Tracks per player:
- `total_xp`: Current XP balance
- `wins_as_author`: Times ranked #1 ("Wittiest")
- `correct_predictions`: Times predicted winner ("Best Oracle")
- `games_played`: Participation count
- `last_active_week`: For weekly bonus/reset features

---

## 📝 License

MIT License - Built for GenLayer Community Contest

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Test thoroughly in GenLayer Studio
4. Submit a pull request

---

**Built with ❤️ for the GenLayer ecosystem**

*Showcasing the future of AI-powered, consensus-driven gaming on the blockchain.*
