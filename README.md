<div align="center">

<img src="docs/images/hero-welcome.png" alt="Oracle of Wit — Welcome Screen" width="100%">

# Oracle of Wit

**The AI humor prediction game powered by GenLayer Intelligent Contracts**

[![Play Now](https://img.shields.io/badge/Play_Now-oracle--of--wit.vercel.app-A855F7?style=for-the-badge&logo=vercel&logoColor=white)](https://oracle-of-wit.vercel.app)
[![GenLayer](https://img.shields.io/badge/Powered_by-GenLayer-2DD4BF?style=for-the-badge)](https://genlayer.com)
[![Tests](https://img.shields.io/badge/Tests-56_passing-22c55e?style=for-the-badge&logo=vitest&logoColor=white)]()
[![License](https://img.shields.io/badge/License-MIT-FBBF24?style=for-the-badge)](LICENSE)

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000?style=flat-square&logo=threedotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?style=flat-square&logo=vercel&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Redis](https://img.shields.io/badge/Upstash_Redis-DC382D?style=flat-square&logo=redis&logoColor=white)

[Play Now](https://oracle-of-wit.vercel.app) | [Report Bug](https://github.com/Ridwannurudeen/oracle-of-wit/issues) | [GenLayer Docs](https://docs.genlayer.com)

</div>

---

## Table of Contents

- [About](#about)
- [How to Play](#how-to-play)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [GenLayer Deep Dive](#genlayer-deep-dive)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Contract API](#contract-api)
- [API Reference](#api-reference)
- [Discord Bot](#discord-bot)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## About

**Oracle of Wit** is a live multiplayer comedy game where players compete to write the funniest joke punchlines, bet on AI predictions, and earn XP. It showcases GenLayer's **Intelligent Contracts** and **Optimistic Democracy** consensus mechanism for decentralized, trustless AI judgment.

Write punchlines. Predict the Oracle's pick. Earn XP. All judged on-chain.

**Live Demo:** [oracle-of-wit.vercel.app](https://oracle-of-wit.vercel.app)

---

## How to Play

```
SUBMIT (40s)  ──>  BET (30s)  ──>  JUDGE (~10s)  ──>  REVEAL  ──>  REPEAT
```

### 1. Submit Your Punchline

<img src="docs/images/submit-phase.png" alt="Submit Phase — Write your punchline" width="100%">

The Oracle delivers a joke setup. You have 40 seconds to write the funniest punchline you can. All submissions are anonymous during betting.

### 2. Bet on the Winner

<img src="docs/images/betting-phase.png" alt="Betting Phase — Predict the Oracle's pick" width="100%">

Read the anonymous punchlines, react with emojis, and stake your XP on which one the Oracle will choose. Wrong predictions cost you.

### 3. AI Validators Judge

<img src="docs/images/judging-validators.png" alt="Judging Phase — 5 AI validators reach consensus" width="100%">

Five AI validators (GPT-4, Claude, LLaMA, Gemini, Mixtral) independently evaluate every submission. They vote via GenLayer's Optimistic Democracy consensus — the result is recorded on-chain.

### 4. Winner Revealed

<img src="docs/images/round-results.png" alt="Round Results — Winner announcement and standings" width="100%">

The winner is crowned with a gold card, confetti, and Oracle commentary. XP gains calculated. Standings updated. Appeal if you disagree.

### Scoring

| Action | XP |
|--------|----|
| Your joke wins | **+100** |
| Correct prediction | **+Bet x 2** |
| Wrong prediction | **-Bet amount** |
| Appeal (successful) | **+50 refund** |
| Appeal (denied) | **-50** |

---

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/images/hero-welcome.png" alt="Welcome Screen"><br><sub><b>Welcome Screen</b> — 3D Oracle Eye, gradient title, feature cards</sub></td>
<td width="50%"><img src="docs/images/lobby-overview.png" alt="Game Lobby"><br><sub><b>Game Lobby</b> — Profile card, mode selection, leaderboard</sub></td>
</tr>
<tr>
<td><img src="docs/images/submit-phase.png" alt="Submit Phase"><br><sub><b>Submit Phase</b> — Joke setup, textarea, timer</sub></td>
<td><img src="docs/images/betting-phase.png" alt="Betting Phase"><br><sub><b>Betting Phase</b> — Submission cards, emoji reactions, bet slider</sub></td>
</tr>
<tr>
<td><img src="docs/images/judging-validators.png" alt="Judging Phase"><br><sub><b>Judging Phase</b> — 5 AI validators, vote bars, on-chain confirmation</sub></td>
<td><img src="docs/images/reveal-winner.png" alt="Reveal Winner"><br><sub><b>Reveal</b> — Winner gold card, confetti sequence</sub></td>
</tr>
<tr>
<td><img src="docs/images/round-results.png" alt="Round Results"><br><sub><b>Round Results</b> — Winner announcement, XP gains, standings</sub></td>
<td><img src="docs/images/discord-bot.png" alt="Discord Bot"><br><sub><b>Discord Integration</b> — Slash commands, open rooms</sub></td>
</tr>
</table>

---

## Architecture

```mermaid
flowchart TB
    subgraph Client ["Browser (SPA)"]
        UI[index.html<br/>Vanilla JS + TailwindCSS + Three.js]
    end

    subgraph Vercel ["Vercel Serverless"]
        API[api/game.js<br/>Room management, scoring,<br/>phase transitions]
    end

    subgraph Storage ["Upstash Redis"]
        Rooms[(room:*)]
        LB[(leaderboard)]
        Players[(player:*)]
        HoF[(hall_of_fame)]
    end

    subgraph AI ["AI Judging (parallel)"]
        Claude[Claude Haiku<br/>Fast winner + roast]
        GL[GenLayer OD<br/>On-chain consensus proof]
    end

    subgraph GenLayer ["GenLayer Testnet Bradbury"]
        Contract[oracle_of_wit.py<br/>Intelligent Contract]
        Validators[AI Validators<br/>GPT-4 / Claude / LLaMA /<br/>Gemini / Mixtral]
    end

    UI -- "HTTP poll / POST" --> API
    API -- "REST" --> Rooms
    API -- "REST" --> LB
    API -- "REST" --> Players
    API -- "REST" --> HoF
    API -- "Claude API" --> Claude
    API -- "genlayer-js SDK" --> GL
    GL -- "writeContract" --> Contract
    Contract -- "gl.exec_prompt" --> Validators
    Validators -- "gl.eq_principle_strict_eq" --> Contract
```

**Why parallel judging?** Claude Haiku returns a winner in ~2s for instant UX. GenLayer OD takes ~30s+ (validators must reach strict consensus) but provides a trustless, on-chain proof. The game shows Claude's result immediately while the GenLayer transaction finalizes in the background.

---

## GenLayer Deep Dive

<img src="docs/images/judging-validators.png" alt="AI Validators reaching consensus" width="100%">

### Optimistic Democracy (OD)

GenLayer's OD consensus is the core innovation this dApp demonstrates. When `judge_round()` is called:

1. A **leader validator** executes the contract and proposes a result
2. Multiple **follower validators** independently re-execute and verify
3. The **Equivalence Principle** compares results across validators
4. If consensus is reached, the result is accepted and recorded on-chain
5. If validators disagree, more validators are added until consensus forms

### Equivalence Principle: `eq_principle_strict_eq`

Oracle of Wit uses the strictest equivalence principle — `gl.eq_principle_strict_eq` — which requires **all validators to return the exact same value**. For comedy judging, this means every validator's LLM must pick the same winner ID.

This is intentionally strict for humor — a subjective domain where LLMs often disagree. The high validator rotation (~22 rotations, ~32 min finalization in testing) demonstrates OD's ability to eventually converge on consensus even for subjective tasks.

### Appeal Mechanism

Players can appeal judgments via `appeal_judgment()`. OD naturally adds more validators for disputed transactions, making appeals inherently more rigorous. If the appeal overturns the original judgment, the contract automatically adjusts the on-chain leaderboard — removing XP from the old winner and awarding it to the new one.

### On-Chain State

| Storage | Type | Purpose |
|---------|------|---------|
| `games` | `TreeMap[str, str]` | Game state (host, category, status, rounds) |
| `leaderboard` | `TreeMap[str, int]` | Player name to total XP score |
| `player_games` | `TreeMap[str, str]` | Player name to list of game IDs |
| `seasons` | `TreeMap[str, str]` | Archived season leaderboards |
| `total_games` | `int` | Lifetime game counter |
| `total_judgments` | `int` | Lifetime OD judgment counter |

<details>
<summary><b>GenLayer SDK Usage (JavaScript)</b></summary>

```javascript
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const account = createAccount(PRIVATE_KEY);
const client = createClient({ chain: testnetBradbury, account });

// Write call — triggers OD consensus
const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'judge_round',
    args: [gameId, jokeSetup, category, submissionsJson],
    value: 0n,
});

// View call — reads on-chain state directly
const history = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: 'get_player_history',
    args: [playerName],
});
```

</details>

---

## Features

| | Feature | Description |
|-|---------|-------------|
| 1 | **Single Player** | Practice mode against 3 AI bot opponents |
| 2 | **Multiplayer** | Real-time games with 2-100 players |
| 3 | **Betting System** | Risk XP to predict the AI's choice |
| 4 | **Leaderboards** | Persistent global + seasonal rankings |
| 5 | **Levels & XP** | 10-level progression from Joke Rookie to Supreme Oracle |
| 6 | **Achievements** | 13 unlockable achievements (streaks, comebacks, milestones) |
| 7 | **Weekly Themes** | Rotating themes: Roast the AI, DeFi Degen, Office Humor |
| 8 | **On-Chain Judging** | GenLayer Optimistic Democracy consensus |
| 9 | **Discord Bot** | Slash commands for playing directly from Discord |
| 10 | **Appeal System** | Challenge any AI judgment via OD re-evaluation |
| 11 | **Player History** | On-chain game history per player |
| 12 | **Season System** | Archivable seasonal leaderboards |
| 13 | **Community Prompts** | User-submitted joke setups with voting |
| 14 | **Hall of Fame** | Historic winning jokes preserved |
| 15 | **Daily Oracle** | Daily challenge with streak tracking |
| 16 | **Dramatic Reveal** | Cinematic reveal sequence with confetti and sound effects |

### Game Categories

- **Tech** — Programming and tech industry jokes
- **Crypto** — Blockchain and DeFi humor
- **General** — Classic comedy for everyone

---

## Tech Stack

| Layer | Technology | Badge |
|-------|------------|-------|
| **Frontend** | Vanilla JavaScript, TailwindCSS, Three.js | ![JS](https://img.shields.io/badge/-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![Tailwind](https://img.shields.io/badge/-TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Three.js](https://img.shields.io/badge/-Three.js-000?style=flat-square&logo=threedotjs&logoColor=white) |
| **Backend** | Vercel Serverless Functions (Node.js) | ![Vercel](https://img.shields.io/badge/-Vercel-000?style=flat-square&logo=vercel&logoColor=white) ![Node](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white) |
| **Database** | Upstash Redis | ![Redis](https://img.shields.io/badge/-Redis-DC382D?style=flat-square&logo=redis&logoColor=white) |
| **AI Judging** | Claude Haiku (fast) + GenLayer OD (on-chain) | ![Anthropic](https://img.shields.io/badge/-Claude-191919?style=flat-square&logo=anthropic&logoColor=white) |
| **Smart Contract** | GenLayer Intelligent Contract (Python) | ![Python](https://img.shields.io/badge/-Python-3776AB?style=flat-square&logo=python&logoColor=white) |
| **SDK** | genlayer-js v0.21+ | ![npm](https://img.shields.io/badge/-genlayer--js-CB3837?style=flat-square&logo=npm&logoColor=white) |
| **Testing** | Vitest | ![Vitest](https://img.shields.io/badge/-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white) |

---

## Project Structure

```
oracle-of-wit/
├── index.html                 # Single-page application (frontend)
├── api/
│   ├── game.js                # Serverless API — rooms, judging, scoring
│   └── discord.js             # Discord bot — slash commands via Interactions API
├── contracts/
│   └── oracle_of_wit.py       # GenLayer Intelligent Contract
├── scripts/
│   ├── deploy.mjs             # Contract deployment to Testnet Bradbury
│   ├── register-commands.mjs  # Register Discord slash commands
│   └── capture-screenshots.mjs # Screenshot capture for README (Playwright)
├── tests/
│   ├── contract.test.js       # Contract logic unit tests (20 tests)
│   ├── api.test.js            # API integration tests (20 tests)
│   └── discord.test.js        # Discord bot tests (16 tests)
├── docs/
│   └── images/                # README screenshots (8 PNGs)
├── package.json               # Dependencies & scripts
├── vercel.json                # Vercel routing configuration
├── .env.example               # Environment variables template
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/cli) (`npm i -g vercel`)
- [Upstash Redis](https://upstash.com/) account
- [Anthropic API](https://console.anthropic.com/) key
- (Optional) GenLayer testnet wallet with GEN tokens

### Local Development

```bash
# Clone
git clone https://github.com/Ridwannurudeen/oracle-of-wit.git
cd oracle-of-wit

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your Upstash and Anthropic credentials

# Run locally
vercel dev

# Open http://localhost:3000
```

### Deploy to Production

```bash
vercel --prod
```

### Deploy Contract to GenLayer Testnet

```bash
# 1. Get GEN tokens from faucet
#    https://testnet-faucet.genlayer.foundation/

# 2. Set your private key
export GENLAYER_PRIVATE_KEY=0x...

# 3. Deploy
node scripts/deploy.mjs

# 4. Update env with the returned contract address
#    GENLAYER_CONTRACT_ADDRESS=0x...
```

---

## Testing

Oracle of Wit has **56 tests** across three test suites:

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

| Suite | File | Tests | Coverage |
|-------|------|-------|----------|
| **Contract** | `tests/contract.test.js` | 20 | Game creation, OD judging, leaderboard, appeals, seasons |
| **API** | `tests/api.test.js` | 20 | Room CRUD, submissions, betting, phase transitions, CORS |
| **Discord** | `tests/discord.test.js` | 16 | Ed25519 signatures, slash commands, error handling |

---

<details>
<summary><h2>Contract API</h2></summary>

### View Functions (read-only, no gas)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `get_game(game_id)` | `str` | Game state dict or `None` | Fetch a game's on-chain state |
| `get_leaderboard(limit=20)` | `int` | List of `{name, score}` | Top players sorted by score |
| `get_stats()` | — | `{total_games, total_judgments}` | Contract lifetime statistics |
| `get_player_history(player_name)` | `str` | `{player_name, total_score, games_played, games[]}` | Player's full game history |
| `get_season(season_id)` | `str` | Archived season data or `None` | Historical season leaderboard |

### Write Functions (triggers OD consensus)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `judge_round(...)` | `game_id, joke_setup, category, submissions` | `{winner_id, winner_name, winning_punchline, consensus_method}` | Judge punchlines via OD — the core gameplay function |
| `create_game(...)` | `game_id, host_name, category` | Game state dict | Register a new game on-chain |
| `record_game_result(...)` | `game_id, final_scores` | `{recorded, players_updated}` | Record final scores to leaderboard |
| `appeal_judgment(...)` | `game_id, joke_setup, category, submissions, original_winner_id` | `{new_winner_id, overturned, consensus_method}` | Re-evaluate a judgment via OD appeal |
| `season_reset(...)` | `season_id` | Archived season data | Archive current leaderboard and reset scores |

</details>

---

<details>
<summary><h2>API Reference</h2></summary>

All endpoints: `POST /api/game?action=<action>` (unless noted as GET)

| Action | Method | Parameters | Description |
|--------|--------|------------|-------------|
| `createRoom` | POST | `hostName`, `category`, `singlePlayer` | Create a new game room |
| `joinRoom` | POST | `roomId`, `playerName`, `spectator?` | Join existing room |
| `getRoom` | GET | `roomId` | Get room state |
| `startGame` | POST | `roomId`, `hostName` | Start game (host only) |
| `submitPunchline` | POST | `roomId`, `playerName`, `punchline` | Submit punchline |
| `placeBet` | POST | `roomId`, `playerName`, `submissionId`, `amount` | Place bet |
| `castVote` | POST | `roomId`, `playerName`, `submissionId` | Vote on curated submission |
| `advancePhase` | POST | `roomId`, `hostName` | Skip to next phase (host only) |
| `nextRound` | POST | `roomId`, `hostName` | Start next round |
| `listRooms` | GET | — | List public rooms |
| `getLeaderboard` | GET | — | Global rankings |
| `getSeasonalLeaderboard` | GET | `season?` | Monthly leaderboard |
| `getPlayerHistory` | GET/POST | `playerName` | On-chain player history |
| `getSeasonArchive` | GET/POST | `seasonId` | Archived season data |
| `getHallOfFame` | GET | — | Historic winning jokes |
| `submitPrompt` | POST | `playerName`, `prompt`, `playerId` | Submit community joke setup |
| `votePrompt` | POST | `promptId`, `playerId` | Vote on community prompt |

</details>

---

## Discord Bot

<img src="docs/images/discord-bot.png" alt="Discord Bot Integration" width="100%">

Oracle of Wit includes a Discord bot that lets users interact with the game directly from Discord using slash commands. It uses Discord's Interactions API (HTTP webhook) — no gateway or WebSocket needed, perfect for Vercel serverless.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/play [category]` | Create a new game room (returns room code + join link) |
| `/leaderboard` | View the top 10 players |
| `/stats [player]` | View global or player-specific stats |
| `/joke [category]` | Get a random joke setup (ephemeral) |
| `/history <player>` | View a player's on-chain game history via GenLayer |

### Setup

1. Create a Discord application at [discord.com/developers](https://discord.com/developers/applications)
2. Copy your **Application ID**, **Public Key**, and **Bot Token**
3. Add them to your environment:
   ```bash
   DISCORD_APPLICATION_ID=your_app_id
   DISCORD_PUBLIC_KEY=your_public_key
   DISCORD_BOT_TOKEN=your_bot_token
   ```
4. Deploy to Vercel (the endpoint is auto-routed to `/api/discord`)
5. In the Discord Developer Portal, set **Interactions Endpoint URL** to:
   ```
   https://oracle-of-wit.vercel.app/api/discord
   ```
6. Register slash commands:
   ```bash
   npm run register-commands
   ```
7. Invite the bot to your server with the `applications.commands` scope

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis auth token |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI judging |
| `GENLAYER_RPC_URL` | No | GenLayer RPC endpoint (defaults to studio API) |
| `GENLAYER_CONTRACT_ADDRESS` | No | Deployed contract address (enables on-chain features) |
| `GENLAYER_PRIVATE_KEY` | No | Wallet key for contract interactions |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook URL for posting game results |
| `DISCORD_APPLICATION_ID` | No | Discord app ID (for slash command registration) |
| `DISCORD_PUBLIC_KEY` | No | Discord public key (for Ed25519 signature verification) |
| `DISCORD_BOT_TOKEN` | No | Discord bot token (for command registration script) |

---

## Contributing

Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

| Resource | Link |
|----------|------|
| Play | [oracle-of-wit.vercel.app](https://oracle-of-wit.vercel.app) |
| GenLayer Docs | [docs.genlayer.com](https://docs.genlayer.com) |
| GenLayer Discord | [discord.gg/genlayer](https://discord.gg/genlayer) |
| GitHub | [github.com/Ridwannurudeen/oracle-of-wit](https://github.com/Ridwannurudeen/oracle-of-wit) |

</div>
