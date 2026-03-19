# Claude / Agent Instructions

This file is for AI agents (Claude, etc.) working on the Negoatiations project. Read this before touching any code.

---

## Project Summary

Negoatiations is a multiplayer browser game. See `PROJECT.md` for the full design spec. See `TASKS.md` for current work items.

---

## Repo Structure (target)

```
/
├── PROJECT.md          # Game design + tech spec
├── CLAUDE.md           # This file — agent instructions
├── TASKS.md            # Project management / task tracking
├── client/             # Phaser 3 frontend (TypeScript)
│   ├── src/
│   │   ├── scenes/     # Phaser scenes (Lobby, Game, etc.)
│   │   ├── ui/         # UI components
│   │   └── net/        # Colyseus client wrappers
│   └── tests/          # UI / integration tests
├── server/             # Node.js + Colyseus backend (TypeScript)
│   ├── src/
│   │   ├── rooms/      # Colyseus room definitions
│   │   ├── logic/      # Pure game logic (unit-testable)
│   │   └── bots/       # AI bot logic
│   └── tests/          # Unit tests
├── shared/             # Types and constants shared between client + server
└── package.json        # Root workspace config (monorepo)
```

---

## Coding Standards

- **Language:** TypeScript everywhere. Strict mode (`"strict": true`).
- **No `any`:** Avoid `any` types. Use `unknown` + type guards if needed.
- **Shared types:** All game state types live in `/shared`. Never duplicate type definitions across client and server.
- **Pure logic:** Game logic (auction rules, scoring, value sheets, etc.) must be **pure functions** with no side effects. Keep them in `server/src/logic/`. This makes unit testing trivial.
- **Authoritative server:** The server is the source of truth. Clients never mutate game state directly — they send actions; the server applies them and broadcasts state.
- **No magic numbers:** Extract all game constants (starting cash, goat count, turn time limit, etc.) into a constants file in `/shared`.

---

## Testing Requirements

Every non-trivial feature needs tests. There are two kinds:

### Unit Tests (server/tests/)
- Test pure game logic functions in isolation
- No network, no Colyseus, no Phaser
- Fast — should run in milliseconds
- Required for: auction logic, scoring, value sheet generation, bot decision-making, state transitions

### UI Tests (client/tests/)
- Test core user-facing flows end-to-end
- Required for: joining a lobby, starting a game, completing an auction turn, end-game score screen
- Use a lightweight browser test runner (Playwright preferred)

**Before marking any task complete, ensure tests exist and pass.**

---

## Working with TASKS.md

- `TASKS.md` is the source of truth for what needs to be done
- Tasks with full detail blocks are **ready to implement**
- Single-line stubs are **not yet defined** — do not implement them without expanding the task first
- When completing a task, mark it `[x]` and add a brief completion note
- When discovering new work, add it to the appropriate section in `TASKS.md`

---

## Common Commands

> These will be populated once the project is scaffolded.

```bash
# Install dependencies
npm install

# Run dev servers (client + server)
npm run dev

# Run unit tests
npm run test:unit

# Run UI tests
npm run test:ui

# Type check everything
npm run typecheck
```

---

## Key Design Decisions (don't reverse without discussion)

1. **Colyseus for all real-time state** — don't introduce a second WebSocket layer or REST calls for game state.
2. **Phaser for all rendering** — don't add a React/DOM UI layer inside the game canvas. DOM elements are OK for lobby/menus outside the canvas.
3. **Monorepo** — client, server, and shared types live in one repo with a root `package.json` workspace.
4. **Bots are server-side** — AI bot logic runs on the server, not the client. Bots act like remote players from the client's perspective.
