# 🎭 Oracle of Wit

> **The AI humor prediction game powered by GenLayer Intelligent Contracts**

[![Play Now](https://img.shields.io/badge/🎮_Play_Now-oracle--of--wit.vercel.app-purple?style=for-the-badge)](https://oracle-of-wit.vercel.app)
[![GenLayer](https://img.shields.io/badge/Powered_by-GenLayer-blue?style=for-the-badge)](https://genlayer.com)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=for-the-badge)](https://vercel.com)

---

## 🎯 What is Oracle of Wit?

**Oracle of Wit** is a multiplayer party game where players compete to write the funniest joke punchlines, bet on AI predictions, and earn XP. It showcases GenLayer's **Intelligent Contracts** and **Optimistic Democracy** consensus mechanism for decentralized AI judgment.

### 🎮 Live Demo: [oracle-of-wit.vercel.app](https://oracle-of-wit.vercel.app)

![Game Screenshot](https://img.shields.io/badge/Status-Live-green?style=flat-square)

---

## 🕹️ How to Play

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SUBMIT      →    2. BET        →    3. JUDGE      →  4. WIN │
│  ───────────        ─────────          ────────────       ───── │
│  Write your         Predict which      AI validators      Earn  │
│  punchline          joke will win      vote using OD      XP!   │
└─────────────────────────────────────────────────────────────────┘
```

### Game Phases

| Phase | Duration | What Happens |
|-------|----------|--------------|
| **1. Submit** | 40 seconds | Complete the AI-generated joke setup with your funniest punchline |
| **2. Bet** | 30 seconds | View anonymous submissions and bet XP on which one will win |
| **3. Judge** | ~10 seconds | Multiple AI validators vote using Optimistic Democracy |
| **4. Results** | — | Winner revealed! Author earns +100 XP, correct predictors double their bets |

### 🏆 Scoring System

| Action | XP Earned |
|--------|-----------|
| Your joke wins | **+100 XP** |
| Correct prediction | **+Bet × 2** |
| Wrong prediction | **-Bet amount** |

---

## ⛓️ GenLayer Integration

This game demonstrates key GenLayer concepts:

### 🗳️ Optimistic Democracy

Multiple AI validators (simulating GPT-4, Claude, LLaMA, Gemini, Mixtral) independently evaluate submissions. Consensus is reached when a majority agrees on the funniest joke.

```python
# From contracts/oracle_of_wit.py
winner_id = gl.eq_principle_strict_eq(judge_comedy)
```

### 📜 Intelligent Contracts

The `oracle_of_wit.py` contract enables:
- **On-chain verification** of AI humor judgments
- **Trustless** betting and reward distribution  
- **Transparent** consensus formation
- **Decentralized** leaderboards

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Single Player** | Practice mode against AI bot opponents |
| 👥 **Multiplayer** | Real-time games with 2-100 players |
| 🎲 **Betting System** | Risk XP to predict the AI's choice |
| 🏆 **Leaderboards** | Persistent global rankings |
| 🔊 **Sound Effects** | Immersive audio feedback |
| ⏱️ **Timed Rounds** | Fast-paced gameplay with visual countdown |
| 📱 **Mobile Friendly** | Responsive design for all devices |
| ⛓️ **On-Chain Judging** | GenLayer Optimistic Democracy consensus |

### Game Categories

- 🤖 **Tech** — Programming and tech industry jokes
- 💎 **Crypto** — Blockchain and DeFi humor  
- 😂 **General** — Classic comedy for everyone

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript, TailwindCSS (CDN) |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Database** | Upstash Redis |
| **AI Judging** | Claude API (Anthropic) |
| **Smart Contract** | GenLayer Intelligent Contract (Python) |
| **Deployment** | Vercel |

---

## 📁 Project Structure

```
oracle-of-wit/
├── index.html              # Single-page application (all frontend code)
├── api/
│   └── game.js             # Serverless API (rooms, submissions, judging)
├── contracts/
│   └── oracle_of_wit.py    # GenLayer Intelligent Contract
├── package.json            # Project metadata & dependencies
├── vercel.json             # Vercel routing configuration
├── .env.example            # Environment variables template
├── LICENSE                 # MIT License
└── README.md               # This file
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/cli) (`npm i -g vercel`)
- [Upstash Redis](https://upstash.com/) account
- [Anthropic API](https://console.anthropic.com/) key

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ridwannurudeen/oracle-of-wit.git
   cd oracle-of-wit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

4. **Run locally**
   ```bash
   vercel dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Deploy to Production

```bash
vercel --prod
```

---

## 🔌 API Reference

All endpoints: `POST /api/game?action=<action>`

| Action | Description | Parameters |
|--------|-------------|------------|
| `createRoom` | Create a new game room | `hostName`, `category`, `singlePlayer` |
| `joinRoom` | Join existing room | `roomId`, `playerName` |
| `getRoom` | Get room state | `roomId` (GET) |
| `startGame` | Start game (host only) | `roomId`, `hostName` |
| `submitPunchline` | Submit punchline | `roomId`, `playerName`, `punchline` |
| `placeBet` | Place bet on submission | `roomId`, `playerName`, `submissionId`, `amount` |
| `advancePhase` | Skip to next phase | `roomId`, `hostName` |
| `nextRound` | Start next round | `roomId`, `hostName` |
| `listRooms` | Get public rooms | — |
| `getLeaderboard` | Get global leaderboard | — |

---

## 📜 GenLayer Smart Contract

The `contracts/oracle_of_wit.py` file contains the GenLayer Intelligent Contract that powers on-chain judging.

### Key Functions

```python
@gl.public.write
def judge_round(self, game_id, joke_setup, category, submissions):
    """
    Judge a round using Optimistic Democracy.
    Multiple AI validators independently decide the funniest punchline.
    """
    winner_id = gl.eq_principle_strict_eq(judge_comedy)
    return winner_id
```

### Deploying to GenLayer

```bash
# Install GenLayer CLI
npm install -g genlayer

# Initialize and start simulator
genlayer init
genlayer up

# Deploy contract
genlayer deploy --contract contracts/oracle_of_wit.py
```

### Testing in GenLayer Studio

1. Open http://localhost:8080 after `genlayer up`
2. Load `contracts/oracle_of_wit.py`
3. Deploy and test with multiple accounts

---

## 🔒 Environment Variables

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis authentication token |
| `ANTHROPIC_API_KEY` | Claude API key for AI judging |

---

## 🤝 Contributing

Contributions welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Contributions

- [ ] Add more joke categories
- [ ] Implement full GenLayer on-chain judging integration
- [ ] Player avatars and customization
- [ ] Tournament mode
- [ ] Social sharing features
- [ ] Voice input for punchlines

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[GenLayer](https://genlayer.com)** — Intelligent Contracts platform
- **[Anthropic](https://anthropic.com)** — Claude AI for joke judging
- **[Upstash](https://upstash.com)** — Serverless Redis
- **[Vercel](https://vercel.com)** — Deployment platform

---

## 🔗 Links

| Resource | Link |
|----------|------|
| 🎮 Play | [oracle-of-wit.vercel.app](https://oracle-of-wit.vercel.app) |
| 📚 GenLayer Docs | [docs.genlayer.com](https://docs.genlayer.com) |
| 💬 GenLayer Discord | [discord.gg/genlayer](https://discord.gg/genlayer) |
| 🐙 GitHub | [github.com/Ridwannurudeen/oracle-of-wit](https://github.com/Ridwannurudeen/oracle-of-wit) |

---

<p align="center">
  <b>Made with ❤️ for the GenLayer Community Contest</b>
  <br><br>
  <i>Showcasing the future of AI-powered, consensus-driven gaming on the blockchain.</i>
</p>
