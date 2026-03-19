# Architecture Decision Records

## ADR-001: Vanilla JS over React/Vue

**Status**: Accepted
**Date**: 2024

### Context
The game needs real-time UI updates, animations, 3D effects, and complex state management.

### Decision
Use vanilla ES modules with no framework.

### Rationale
- Zero bundle overhead — CDN-loaded Three.js + Tailwind are the only external scripts
- Full control over DOM update timing (typing guards, render throttling, partial patches)
- No virtual DOM overhead for the polling-based update model
- Simpler mental model for a single-developer project
- `html` tagged template provides auto-escaping without a framework

### Consequences
- Manual state management via `state.js` singleton
- innerHTML-based rendering requires `esc()` discipline (mitigated by `html` tag)
- No component lifecycle — mount/unmount handled manually

---

## ADR-002: Upstash REST API over Redis Protocol

**Status**: Accepted

### Context
Need persistent state storage compatible with Vercel serverless functions.

### Decision
Use Upstash Redis via REST API instead of traditional Redis protocol.

### Rationale
- Vercel serverless functions are stateless and short-lived — TCP connections can't persist
- Upstash REST API works over HTTPS, compatible with serverless cold starts
- Built-in at-rest encryption and automatic backups
- Free tier sufficient for development/hackathon

### Consequences
- Higher latency per operation (~5-10ms vs ~1ms for TCP Redis)
- Circuit breaker pattern needed to handle REST API failures gracefully
- Distributed locks via SETNX REST calls (atomicity guaranteed by Upstash)

---

## ADR-003: Dual Judging (GenLayer OD + Claude AI)

**Status**: Accepted

### Context
Comedy judging needs to be fair, verifiable, and always available.

### Decision
Run GenLayer Optimistic Democracy and Claude AI in parallel. GenLayer is authoritative when available; Claude provides fast fallback.

### Rationale
- GenLayer OD provides on-chain verifiable consensus — multiple validators must agree
- Claude AI provides instant results with no on-chain latency
- Parallel execution: both run simultaneously, GenLayer overrides if it succeeds
- Triple fallback: GenLayer → Claude AI → coin flip ensures games never stall

### Consequences
- Higher API costs (two AI calls per round)
- Complex result reconciliation logic in `autoJudge()`
- GenLayer cooldown needed to prevent rate limiting

---

## ADR-004: Polling over WebSockets

**Status**: Accepted

### Context
Real-time updates needed for multiplayer gameplay.

### Decision
Use adaptive polling with phase-based intervals instead of WebSockets.

### Rationale
- Vercel serverless does not support persistent WebSocket connections
- Adaptive polling (1.5s during judging → 10s when idle) balances freshness vs. cost
- Hash-based change detection skips unnecessary re-renders
- Tab visibility detection reduces background polling to 30s
- Exponential backoff on failures prevents thundering herd

### Consequences
- 1-2s latency for state updates (acceptable for turn-based game)
- Higher server request volume than WebSockets
- Connection banner shown during degraded polling

---

## ADR-005: Session Tokens over JWTs

**Status**: Accepted

### Context
Need to authenticate players for mutating game actions.

### Decision
Use `crypto.randomUUID()` tokens stored in Redis with TTL, not JWTs.

### Rationale
- Server-side session validation is simpler and more secure than JWT verification
- Tokens can be revoked instantly by deleting from Redis
- No JWT secret management or rotation needed
- TTL-based expiry (2 hours) matches game session lifecycle

### Consequences
- Redis dependency for auth (mitigated by circuit breaker)
- Token must be included in every mutating request body
