# Contributing to Oracle of Wit

## Quick Start

```bash
git clone https://github.com/Ridwannurudeen/oracle-of-wit.git
cd oracle-of-wit
npm install
cp .env.example .env  # Fill in your keys
npm test              # 289 tests should pass
npm run build         # Verify Vite build
```

## Development

```bash
npm run test:watch    # Watch mode
npm run lint          # ESLint (0 errors expected)
npx vite              # Local dev server with API proxy
```

## Architecture

See [docs/ADR.md](docs/ADR.md) for architecture decisions.

| Layer | Location | Purpose |
|-------|----------|---------|
| API Router | `api/game.js` | Thin dispatcher, auth, rate limiting |
| Handlers | `api/handlers/*.js` | Business logic per action |
| Libraries | `api/lib/*.js` | Shared: Redis, AI, GenLayer, auth, logging |
| Frontend | `js/*.js` | ES modules, no framework |
| Contract | `contracts/oracle_of_wit.py` | GenLayer Intelligent Contract |
| Tests | `tests/*.test.js` | Vitest (289 tests across 5 suites) |

## Testing

- `tests/game-logic.test.js` — Core state machine (44 tests)
- `tests/api.test.js` — Full API integration with Redis mock (93 tests)
- `tests/frontend.test.js` — Frontend utilities + XSS prevention (76 tests)
- `tests/contract.test.js` — Smart contract logic (60 tests)
- `tests/discord.test.js` — Discord bot (16 tests)

## Guidelines

- Run `npm test` before committing
- Run `npm run lint` — 0 errors expected
- Use `esc()` or the `html` tagged template for all user-supplied content in renders
- Add JSDoc to all exported functions
- Add tests for new handlers and game-logic functions
