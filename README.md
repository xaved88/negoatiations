# Negoatiations

A multiplayer browser game about trading goats. Deduce what your opponents value, bluff your way to the best deals, and end the game with the highest score.

---

## Prerequisites

- Node.js v18+ (tested on v22)
- npm v9+

---

## Setup

Install all dependencies from the repo root:

```bash
npm install
```

---

## Running the game

Start both the game server and client dev server with a single command:

```bash
npm run dev
```

Then open **http://localhost:5173** in your browser.

To play with two players locally, open the same URL in a second browser tab (or window). One tab creates a game, the other joins it.

### How to play

1. Enter your name and click **Create Game** — your game will appear in the lobby list.
2. In the second tab, enter a name and click your game from the list to join.
3. Either player clicks **Start Game** once both are seated.
4. The first auctioneer clicks one of their goat cards to put it up for auction.
5. The other player enters a cash amount and clicks **Bid**.
6. The auctioneer clicks **Accept** on a bid to complete the trade.
7. Turns rotate until all rounds are played, then the score screen appears showing everyone's secret value sheets and final scores.

---

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Start both servers (client on :5173, game server on :2567) |
| `npm run test:unit` | Run all server unit tests (35 tests covering game logic) |
| `npm run typecheck` | TypeScript type-check all three packages |
| `npm run test:ui` | Run Playwright end-to-end tests (requires `npm run dev` running in another terminal) |

---

## Project structure

```
negoatiations/
├── shared/       # Types and constants shared between client and server
├── server/       # Node.js + Colyseus game server (port 2567)
│   ├── src/
│   │   ├── logic/    # Pure game logic functions (unit tested)
│   │   └── rooms/    # Colyseus GameRoom
│   └── tests/        # Unit tests (jest)
├── client/       # Vite + Phaser 3 frontend (port 5173)
│   ├── src/
│   │   ├── scenes/   # Phaser scenes (GameScene, ScoreScene)
│   │   ├── lobby.ts  # DOM-based lobby UI
│   │   └── main.ts   # Entry point
│   └── tests/        # Playwright UI tests
├── PROJECT.md    # Full game design spec
├── TASKS.md      # Project task tracking
└── CLAUDE.md     # Instructions for AI agents working on this codebase
```

---

## Current state (Slice 1)

The game is functional but minimal by design — Slice 1 is about proving the full loop works end to end:

- ✅ Lobby: create and join games
- ✅ Dealing: goats distributed across players, secret value sheets generated
- ✅ Auctions: put a goat up, place cash bids, accept a bid
- ✅ Scoring: cash + goat values tallied at game end
- ✅ Score screen: value sheets revealed, winner highlighted
- ⏳ Coming in Slice 2: hold/reject bidding, trading goats (not just cash), auction timer
- ⏳ Coming in Slice 3: AI bots fill empty seats
- ⏳ Coming later: goat art & animations, sound effects
