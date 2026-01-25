# Oracle of Wit - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install GenLayer CLI

```bash
npm install -g genlayer
```

### 2. Initialize & Start Simulator

```bash
# Initialize with 5 validators
genlayer init

# Start the simulator (Docker required)
genlayer up
```

### 3. Open GenLayer Studio

Navigate to http://localhost:8080 in your browser.

### 4. Deploy the Contract

**Option A: Via Studio**
1. Click "Load Contract" 
2. Paste the contents of `oracle_of_wit.py`
3. Click "Deploy"
4. Note the contract address

**Option B: Via CLI**
```bash
genlayer deploy --contract oracle_of_wit.py
```

### 5. Test the Game

In GenLayer Studio's "Execute Transactions" panel:

```
Step 1: Create accounts and fund them
- Use the Accounts panel to create 3-4 test accounts
- Fund each with test tokens

Step 2: Deposit XP (for each account)
- Method: deposit_xp
- Value: 1000 (or any amount)

Step 3: Create a game (Account 1 - Alice)
- Method: create_game
- Args: [2, 10, 10, 100]

Step 4: Join game (Account 2 - Bob)
- Method: join_game
- Args: ["GAME_1"]

Step 5: Start game (Account 1 - Alice)
- Method: start_game
- Args: ["GAME_1"]
- ⏳ Wait for AI to generate joke prompt

Step 6: Submit punchlines (each account)
- Method: submit_punchline
- Args: ["GAME_1", "Your funny punchline here"]

Step 7: Start betting (Account 1)
- Method: start_betting_phase
- Args: ["GAME_1"]

Step 8: Place bets (each account)
- Method: place_bet
- Args: ["GAME_1", 1, 50]  // bet 50 XP on submission #1

Step 9: Finalize judging (any account)
- Method: finalize_judging
- Args: ["GAME_1"]
- ⏳ Wait for AI consensus

Step 10: Check results
- Method: get_game_state
- Args: ["GAME_1"]
```

---

## 📁 Project Structure

```
oracle-of-wit/
├── oracle_of_wit.py      # Main intelligent contract
├── README.md             # Full documentation
├── QUICKSTART.md         # This file
├── deploy.ts             # Deployment script
├── test_oracle_of_wit.py # Test suite
├── package.json          # Node.js dependencies
└── frontend/
    └── OracleOfWit.tsx   # React components
```

---

## 🔑 Key Contract Methods

### Player Actions
| Method | Description |
|--------|-------------|
| `deposit_xp()` | Add XP (send value with tx) |
| `withdraw_xp(amount)` | Withdraw XP |
| `join_game(game_id)` | Join a game room |
| `submit_punchline(game_id, text)` | Submit your punchline |
| `place_bet(game_id, sub_id, amount)` | Bet on a submission |

### Host Actions
| Method | Description |
|--------|-------------|
| `create_game(min, max, bet_min, bet_max)` | Create new game |
| `start_game(game_id)` | Start the game |
| `start_betting_phase(game_id)` | Begin betting |

### Anyone Can Call
| Method | Description |
|--------|-------------|
| `finalize_judging(game_id)` | Trigger AI judging |

### View Methods
| Method | Description |
|--------|-------------|
| `get_game_state(game_id)` | Full game state |
| `get_balance(player)` | Player's XP balance |
| `get_player_score(player)` | Leaderboard stats |
| `get_contract_info()` | Contract config |

---

## 🎯 What Makes This Special

1. **AI-Generated Content**: Each game has a unique joke prompt created by LLM
2. **Subjective AI Judgment**: Multiple validators reach consensus on "funniest"
3. **Optimistic Democracy**: GenLayer's unique consensus mechanism in action
4. **On-Chain Gaming**: Full game state stored on blockchain
5. **Economic Incentives**: XP betting creates engagement

---

## 🐛 Troubleshooting

**"Transaction pending forever"**
- Check validator logs in Studio
- Ensure enough validators are running

**"AI generation failed"**
- Validators need LLM provider configured
- Check LLM API keys in Studio settings

**"Insufficient balance"**
- Call `deposit_xp` with value first
- Check balance with `get_balance`

**"Not in correct phase"**
- Games progress: waiting → submitting → betting → judging → finished
- Check `get_game_state` for current status

---

## 📚 Learn More

- [GenLayer Docs](https://docs.genlayer.com)
- [Intelligent Contracts Guide](https://docs.genlayer.com/developers/intelligent-contracts/introduction)
- [Equivalence Principle](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/equivalence-principle)
- [GenLayerJS SDK](https://docs.genlayer.com/developers/decentralized-applications/genlayer-js)

---

Happy gaming! 🎭🎮
