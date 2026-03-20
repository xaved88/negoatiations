# Negoatiations — Task Tracker

## Philosophy: Vertical Slices

Each slice delivers a **working, tested, playable build**. We never finish a slice without tests. We never start a new slice without the previous one being stable. Slices expand functionality on top of a real running game — not bottom-up layers.

Status indicators:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

---

## Slice 0: Project Setup

### [x] Initialize project documents
**Completed:** PROJECT.md, CLAUDE.md, and TASKS.md created.

### [~] Define tasks and next steps
**Status:** In progress
**Goal:** Establish the vertical slice breakdown before any implementation begins.
**Output:** This TASKS.md file, with Slice 1 tasks fully detailed and Slices 2+ stubbed.
**Acceptance criteria:** Every Slice 1 task has a complete detail block. An agent can pick up any Slice 1 task and implement it without further clarification.

---

## Slice 1: A Complete (Minimal) Playable Game

**Goal:** Two human players can open the game in a browser, create/join a room, play a full game (deal → auction rounds → scoring), and see a final score screen. All server logic is unit tested. The full user flow has a UI test.

This slice deliberately keeps things minimal: accept-only auctions (no hold/reject), cash-only bids (no goat trading), placeholder art, no bots, no timers. The point is a real end-to-end game loop that works and is tested.

---

### [x] Scaffold monorepo

**Completed:** Root package.json with npm workspaces, all three packages (shared, server, client) with proper tsconfig.json files, TypeScript path aliases configured. Root npm scripts for dev, test:unit, test:ui, typecheck all working. All dependencies installed.

**Description:** Set up the project skeleton so all three packages exist, TypeScript is configured, and dev servers run.

**Tasks:**
- Create root `package.json` with npm workspaces: `client`, `server`, `shared`
- Init each package with its own `package.json` and `tsconfig.json` (strict mode, path aliases for `shared`)
- Add Vite + Phaser 3 to `client/` — display a placeholder "Negoatiations" title screen
- Add Colyseus + Node.js to `server/` — a `HelloRoom` that echoes a ping message back to any connected client
- Wire the client to connect to the Colyseus server on startup and log a confirmed connection in the browser console
- Configure Vitest in `server/` with a passing smoke test (`1 + 1 === 2`)
- Configure Playwright in `client/` with a passing smoke test (page title contains "Negoatiations")
- Add root-level npm scripts: `dev` (runs both servers), `test:unit`, `test:ui`, `typecheck`

**Acceptance criteria:**
- `npm run dev` starts both servers without errors
- Browser loads the client and console shows a successful Colyseus connection
- `npm run test:unit` passes
- `npm run test:ui` passes
- `npm run typecheck` passes with zero errors

---

### [x] Shared types and constants

**Completed:** All types defined in shared/src/types.ts (GoatType, Goat, ValueSheet, Bid, BidEntry, AuctionState, PlayerState, GameState, and all message types). All constants defined in shared/src/constants.ts with TEST_MODE support for TURNS_PER_GAME.

**Description:** Define all types and constants that client and server both depend on. These live in `shared/` and are never duplicated.

**Types to define:**
- `GoatType` — enum: `Silly | Angry | Happy | Hungry`
- `Goat` — `{ id: string; type: GoatType }`
- `ValueSheet` — `Record<GoatType, number>` (points per goat type)
- `Bid` — `{ cash: number; goats: Goat[] }`
- `AuctionState` — `{ auctioneerPlayerId: string; goatOnOffer: Goat; bids: BidEntry[]; status: 'open' | 'closed' }`
- `BidEntry` — `{ bidderId: string; bid: Bid }`
- `PlayerState` — `{ id: string; name: string; hand: Goat[]; cash: number; isBot: boolean }`
- `GameState` — `{ players: PlayerState[]; phase: 'lobby' | 'playing' | 'ended'; currentAuctioneerIndex: number; auction: AuctionState | null; turnNumber: number; scores: Record<string, number> | null }`

**Client → Server messages:**
- `PutUpForAuction` — `{ goatId: string }`
- `PlaceBid` — `{ bid: Bid }`
- `AcceptBid` — `{ bidderId: string }`

**Server → Client messages:** (Colyseus state sync handles most; define explicit events for:)
- `AuctionAccepted` — `{ winnerId: string; loserId: string; bid: Bid }`
- `GameOver` — `{ scores: Record<string, number>; valueSheets: Record<string, ValueSheet> }`

**Constants (in `shared/constants.ts`):**
- `MAX_PLAYERS = 5`
- `STARTING_CASH = 100`
- `GOATS_PER_PLAYER = 5`
- `GOAT_TYPE_COUNT` (number of distinct types)
- `TURNS_PER_GAME` (total auction turns before game ends; start with `MAX_PLAYERS * 3`)

**Acceptance criteria:**
- `npm run typecheck` passes with zero errors
- Both `client/` and `server/` can import from `shared/` without issues
- No type definitions duplicated across client or server

---

### [x] Server: pure game logic

**Completed:** All pure logic functions implemented (dealHands, generateValueSheets, validateBid, applyAcceptedBid, nextAuctioneerIndex, isGameOver, computeScores). Full unit test suite with 5+ test cases per function covering happy paths, edge cases, and invalid inputs. All tests compile successfully with TypeScript.

**Description:** Implement all game logic as pure functions in `server/src/logic/`. No Colyseus, no network, no side effects. Each function has corresponding unit tests.

**Description:** Implement all game logic as pure functions in `server/src/logic/`. No Colyseus, no network, no side effects. Each function has corresponding unit tests.

**Functions to implement:**

`dealing.ts`
- `dealHands(playerCount: number, goatsPerPlayer: number): Goat[][]` — randomly distributes goats across hands, each hand having a balanced mix of types

`valueSheets.ts`
- `generateValueSheets(playerCount: number): ValueSheet[]` — produces one unique value sheet per player; all players' sheets should use the same range of values but assigned to different types so no two players value goats identically

`bidding.ts`
- `validateBid(bid: Bid, bidderState: PlayerState): boolean` — confirms the bidder actually has the goats and cash they're offering
- `applyAcceptedBid(auctioneer: PlayerState, bidder: PlayerState, goatOnOffer: Goat, bid: Bid): [PlayerState, PlayerState]` — returns updated auctioneer and bidder states after the exchange

`turns.ts`
- `nextAuctioneerIndex(current: number, playerCount: number): number` — simple round-robin
- `isGameOver(turnNumber: number): boolean` — returns true when `turnNumber >= TURNS_PER_GAME`

`scoring.ts`
- `computeScores(players: PlayerState[], valueSheets: Record<string, ValueSheet>): Record<string, number>` — for each player: `cash + sum(goat counts × value per type)`

**Unit tests required for every function above.** Tests should cover:
- Happy path
- Edge cases (empty hand, zero cash bids, ties in scoring, etc.)
- Invalid inputs (bid validation with insufficient funds/goats)

**Acceptance criteria:**
- `npm run test:unit` passes
- 100% of the functions listed above have at least 3 test cases each
- No `any` types

---

### [x] Server: Colyseus GameRoom (Slice 1)

**Completed:** Full GameRoom implementation with all required handlers (onCreate, onJoin, onLeave, StartGame, PutUpForAuction, PlaceBid, AcceptBid). Proper state management, private value sheet handling, and game over detection. Server index.ts configured to run Colyseus on port 2567.

**Description:** Wire the pure logic functions into a Colyseus `GameRoom`. The room manages state, receives player messages, and broadcasts updates.

**Description:** Wire the pure logic functions into a Colyseus `GameRoom`. The room manages state, receives player messages, and broadcasts updates.

**Responsibilities:**
- `onCreate`: initialize empty room state
- `onJoin`: add player to state; auto-start game when 2+ players are seated and host sends start message (Slice 1 simplification — no waiting room gating yet)
- `onLeave`: mark player as disconnected (don't crash the game)
- Handle `PutUpForAuction`: validate it's the auctioneer's turn, set auction state
- Handle `PlaceBid`: validate bid (use `validateBid`), add to auction's bid list
- Handle `AcceptBid`: apply the exchange (use `applyAcceptedBid`), advance the turn, check for game over
- On game over: compute scores (use `computeScores`), broadcast `GameOver` event with value sheets revealed
- Colyseus schema: define `@Schema` classes for `GameState`, `PlayerState`, `AuctionState` etc.

**Acceptance criteria:**
- Two browser tabs can connect to the same room
- A full game (deal → auction loop → game over) completes without server errors
- State updates are received by both clients after every action

---

### [x] Client: Lobby scene

**Completed:** DOM-based lobby with player name input, Create Game button, and dynamically updating list of available rooms. Room list polls Colyseus matchMaker every 2 seconds. Proper transitions to Game scene on join/create.

**Description:** The first screen players see. Lists open games and lets players create or join one.

**Description:** The first screen players see. Lists open games and lets players create or join one.

**UI elements:**
- Text input: player name
- "Create Game" button — creates a new Colyseus room, transitions to Game scene
- List of open games — each shows "{Host Name}'s game" and a player count badge; clicking joins and transitions to Game scene
- List polls or subscribes for updates every few seconds

**Implementation notes:**
- Use DOM elements (not Phaser canvas) for the lobby — it's outside the game proper
- Colyseus `matchMaker.getAvailableRooms("game")` to list open rooms
- Store the player name in memory for the session

**Acceptance criteria:**
- Player can create a room and see it appear in the list
- A second player can join the room from the list
- Both players transition to the Game scene

---

### [x] Client: Game scene (Slice 1)

**Completed:** Full Phaser GameScene with all UI panels (Your Hand, Auction Panel with bids and accept/bid buttons, Other Players info, Turn indicator, Value Sheet display). Proper handling of auctioneer vs bidder states, real-time state updates from server, and private value sheet display.

**Description:** The in-game Phaser scene. Shows the player's hand, the active auction, and other players' public info.

**Description:** The in-game Phaser scene. Shows the player's hand, the active auction, and other players' public info.

**Panels / components:**

*Your Hand panel*
- Displays each goat in your hand as a labeled card (type name + placeholder colored rectangle for now)
- On your turn as auctioneer: clicking a goat puts it up for auction (sends `PutUpForAuction`)

*Auction panel* (visible when auction is active)
- Shows the goat on offer (whose it is, what type)
- Lists all bids placed so far (bidder name + cash amount)
- If you are NOT the auctioneer: shows a cash input + "Place Bid" button (sends `PlaceBid`)
- If you ARE the auctioneer: shows "Accept" button next to each bid (sends `AcceptBid`)

*Other players panel*
- For each other player: name, goat count (not types), cash balance

*Your info panel*
- Your name, cash balance, goat count
- Your value sheet (visible only to you)

*Turn indicator*
- Shows whose turn it is to auction

**Acceptance criteria:**
- A complete game loop is playable in the browser
- State updates from server are reflected in real time
- Auctioneer controls are only shown to the correct player

---

### [x] Client: Score screen

**Completed:** ScoreScene displaying ranked players with scores, value sheets revealed for all players, and Return to Lobby button. Proper formatting and winner highlighting.

**Description:** Shown when the server emits `GameOver`. Reveals all value sheets and final scores.

**Description:** Shown when the server emits `GameOver`. Reveals all value sheets and final scores.

**UI elements:**
- Table: one row per player showing name, final cash, goat breakdown, total score
- Value sheet reveal: each player's sheet is shown so players can see how others valued goats
- Winner highlight
- "Return to Lobby" button

**Acceptance criteria:**
- Score screen appears automatically when game ends
- All scores match server-computed values
- "Return to Lobby" navigates back to the Lobby scene

---

### [x] UI test: full Slice 1 game flow

**Completed:** Playwright test (game-flow.spec.ts) covering full end-to-end user journey: two browser contexts, player creation/joining, game start, auction turns, bidding, and score screen. Proper waiting and element interaction patterns.

**Description:** Playwright test that exercises the complete end-to-end user journey.

**Description:** Playwright test that exercises the complete end-to-end user journey.

**Test scenario:**
1. Open two browser contexts (Player A and Player B)
2. Player A enters a name and creates a game
3. Player B enters a name and joins Player A's game from the lobby list
4. Both players see the Game scene
5. Player A (first auctioneer) selects a goat to auction
6. Player B places a cash bid
7. Player A accepts the bid
8. Turn advances; play continues until game ends (or fast-forward via enough turns)
9. Score screen appears with correct data for both players
10. Both players click "Return to Lobby" and arrive back at the lobby

**Acceptance criteria:**
- Test runs headlessly in CI
- Test passes reliably (no flakiness from timing)
- Both player perspectives are validated

---

## Slice 2: Rich Auction Mechanics

**Goal:** Auctions become full-featured. Auctioneers can hold or reject bids. Bidders can include goats in their offers. Auctions auto-close after a timer expires.

---

### [ ] Server: Hold and Reject bid mechanics

**Description:** Give the auctioneer more control over in-progress auctions.

**Hold:** Marks a bid as the current best offer, signaling to other players that they need to beat it. The auction remains open. If the timer expires while a bid is held, that bid is auto-accepted.

**Reject:** Removes a bid from the auction entirely. The rejected player may bid again.

**Changes:**
- Add `heldBidderId: string | null` to `AuctionState` in `shared/types.ts` — tracks which bid (by player ID) is currently held
- Add `HoldBidMsg` and `RejectBidMsg` client→server message types to `shared/types.ts`
- Add `applyRejectedBid(bids: BidEntry[], bidderId: string): BidEntry[]` pure function in `server/src/logic/bidding.ts` — returns the bid list with that entry removed
- Add `handleHoldBid` and `handleRejectBid` handlers to `GameRoom`
  - Both validate that the caller is the current auctioneer
  - `handleHoldBid`: sets `auction.heldBidderId` to the given player ID
  - `handleRejectBid`: calls `applyRejectedBid`, clears `heldBidderId` if the rejected bid was held, broadcasts state

**Acceptance criteria:**
- Auctioneer can hold any open bid; `heldBidderId` is reflected in broadcast state
- Auctioneer can reject any open bid; it is removed from `auction.bids`
- Rejecting the held bid also clears `heldBidderId`
- Non-auctioneers cannot hold or reject bids (silently ignored)

---

### [ ] Server: Auction timer

**Description:** Each auction automatically closes after a fixed number of seconds (`AUCTION_TIMER_SECONDS`). If a bid is held when the timer fires, it is auto-accepted. If no bid is held, the auction ends with no sale and the turn advances.

**Changes:**
- Add `AUCTION_TIMER_SECONDS = 30` constant to `shared/constants.ts`
- Add `timerEndsAt: number | null` to `AuctionState` in `shared/types.ts` — Unix timestamp (ms) when the auction closes, broadcast to clients so they can display a countdown
- In `GameRoom`: store a `private auctionTimer: ReturnType<typeof setTimeout> | null` (server-internal, not in game state)
- In `handlePutUpForAuction`: set `auction.timerEndsAt = Date.now() + AUCTION_TIMER_SECONDS * 1000` and start the timeout
- In `handleAcceptBid`: clear the timer before applying the bid
- Add `private handleAuctionTimeout()`: if a bid is held, auto-accept it (same logic as `handleAcceptBid`); then advance turn / check game over regardless. Extract shared `endAuction()` helper to avoid duplication.

**Acceptance criteria:**
- Auction auto-closes after `AUCTION_TIMER_SECONDS` seconds
- If a held bid exists at timeout, it is accepted and the exchange is applied
- If no held bid exists at timeout, turn advances with no exchange (goat stays with auctioneer)
- Manual `AcceptBid` clears the timer so it doesn't fire late

---

### [ ] Server: Goat-inclusive bids

**Description:** Bidders can include goats from their hand in a bid. The exchange when a bid is accepted becomes: bidder gives `bid.cash` + `bid.goats` to auctioneer; auctioneer gives `goatOnOffer` to bidder.

**Changes:**
- Update `validateBid` in `server/src/logic/bidding.ts`:
  - Check bidder has all goats listed in `bid.goats` (match by `id`)
  - Check no duplicate goat IDs in `bid.goats`
  - Add `bid.cash >= 0` guard
- Update `applyAcceptedBid` in `server/src/logic/bidding.ts`:
  - Auctioneer gains `bid.goats` (adds them to hand), loses `goatOnOffer`, gains `bid.cash`
  - Bidder loses `bid.goats` (removes from hand), gains `goatOnOffer`, loses `bid.cash`
- Remove the "Slice 1" comment from `Bid.goats` in `shared/types.ts`

**Acceptance criteria:**
- `validateBid` rejects bids where bidder lacks an offered goat
- `validateBid` rejects bids with duplicate goat IDs
- `applyAcceptedBid` correctly transfers goats in both directions
- Cash-only bids (empty `goats` array) still work as before

---

### [ ] Client: Hold/Reject controls and timer display

**Description:** Update the auction panel so the auctioneer can hold and reject bids, and all players can see the auction countdown.

**Changes (in `GameScene.updateAuctionPanel`):**
- For each bid, if current player is auctioneer: show three buttons — **Accept**, **Hold**, **Reject**
  - Accept: already exists
  - Hold: sends `HoldBid { bidderId }`, styled in amber/yellow
  - Reject: sends `RejectBid { bidderId }`, styled in red
- Highlight the held bid row (e.g., green background or "★ HELD" label) so it's visually distinct
- Add a timer text element that shows seconds remaining, updated every frame in `GameScene.update()`
  - Derive seconds from `state.auction.timerEndsAt - Date.now()`
  - Show in red when ≤ 10 seconds remain

**Acceptance criteria:**
- Auctioneer sees Accept / Hold / Reject for each bid
- Held bid is visually highlighted
- Timer countdown is visible to all players and turns red at ≤10 seconds

---

### [ ] Client: Goat selection in bid composer

**Description:** Non-auctioneer players can include goats from their hand when placing a bid.

**Changes (in `GameScene.updateAuctionPanel`):**
- Add a goat selection area to the bid composer (visible only when not auctioneer)
- Show each goat in the bidder's hand as a toggle button (click to select/deselect)
- Track selected goat IDs in a class property `private selectedBidGoatIds: Set<string>`
- When "Place Bid" is submitted, include selected goats in the `PlaceBid` message: `{ bid: { cash, goats: selectedGoatsArray } }`
- Clear `selectedBidGoatIds` after a bid is placed
- Update the bid display to show goats in bids: `Bob: 12 cash + [Silly, Angry]` (or just "12 cash" for cash-only bids)

**Acceptance criteria:**
- Bidder can toggle goats on/off for inclusion in their bid
- Selected goats are sent with the bid
- Bid display shows goat types when present
- Deselected state resets after each bid

---

### [ ] Unit tests: Slice 2 logic

**Description:** Full test coverage for all new and updated logic functions.

**New tests in `server/tests/bidding.test.ts`:**

`validateBid` additions:
- Returns false when bid includes a goat the bidder doesn't have
- Returns false when bid includes duplicate goat IDs
- Returns false when `bid.cash` is negative
- Returns true when bid includes valid goats from bidder's hand

`applyAcceptedBid` additions:
- Auctioneer gains bid goats in hand
- Bidder loses bid goats from hand
- Cash-only bid (no goats) still works (regression)

`applyRejectedBid` (new):
- Removes the target bid from the list
- Returns unchanged list if bidderId not found
- Works correctly when removing the only bid
- Works correctly when multiple bids exist

**Acceptance criteria:**
- `npm run test:unit` passes
- All new functions have ≥ 3 test cases each

---

### [ ] UI test: Slice 2 flows

**Description:** Add Playwright scenarios covering the new mechanics.

**New test scenarios (new `describe` block in `game-flow.spec.ts` or a new file):**

1. **Hold then accept a different bid:**
   - Player A auctions a goat
   - Player B places a bid
   - Player A holds Player B's bid
   - (Simulate second bidder or Player B raises bid)
   - Player A accepts the second/raised bid
   - Turn advances

2. **Reject a bid:**
   - Player A auctions a goat
   - Player B places a bid
   - Player A rejects it
   - Bid disappears from the auction panel
   - Player B can bid again

3. **Goat-inclusive bid:**
   - Player A auctions a goat
   - Player B selects a goat toggle and enters cash amount
   - Player B places bid
   - Bid panel shows goat types in the bid
   - Player A accepts; goat exchange is reflected in both players' hand counts

**Acceptance criteria:**
- Tests run headlessly
- All three scenarios pass reliably

---

## Slice 3: Bots Fill Empty Seats

**Goal:** Server-side bots auto-fill empty seats so every game has 5 participants. Bots have a pluggable strategy interface so future strategies (conservative, risky, random) can be swapped in without touching GameRoom wiring.

---

### [x] Bot strategy interface + BotManager

**Completed:** `server/src/bots/BotStrategy.ts` defines the `BotStrategy` interface with three decision methods (`decideAuction`, `decideBid`, `decideAccept`). Each returns a typed action object including a `delayMs` field so the caller controls all timing. `BotManager` (`server/src/bots/BotManager.ts`) manages named setTimeout handles, cancelling stale timers on reschedule and providing `cancelAll()` for room disposal.

---

### [x] NaiveBotStrategy implementation

**Completed:** `server/src/bots/NaiveBotStrategy.ts` implements `BotStrategy` with naive but readable decision logic:

- **Auctioneering:** Sells the lowest-value goat first (least regret). Delays 1–3 s.
- **Bidding:** Bids only if profitable (goatValue > currentMaxBid + profit buffer). Uses chunked increments of 5–15 gold rounded up to nearest 5 (not "+1 forever"). Caps bids at goatValue − random buffer (3–8). Delays 1.5–5 s.
- **Accepting:** Accepts the highest bid ≥ 70% of the goat's personal value. Considers both open and held bids. Delays 2–5 s.

Pure helper functions (`randInt`, `roundUpToStep`, `currentMaxBid`, `highestBidEntry`) are exported for unit testing.

---

### [x] Bot seat auto-fill + GameRoom wiring

**Completed:** `GameRoom.fillWithBots()` adds named bot players (Bailey, Chester, Daisy, Earl, Fern) to fill seats to MAX_PLAYERS (5) when the host starts the game. Bots receive value sheets and hands in the same deal as humans. GameRoom now calls:

- `scheduleIfBotTurn()` after every `endAuction()` — triggers bot auctioneer if needed
- `triggerBotBidders()` after every auction opens or a bid changes — each non-auctioneer bot gets a fresh, randomly-timed evaluation
- `triggerBotAuctioneerAccept()` after any bid change — bot auctioneer re-evaluates whether to accept
- `cancelAll()` on room dispose to prevent stale callbacks
- Stale-state guards throughout: all execution callbacks re-validate phase/auction/player state before acting

---

### [x] Unit tests for bot decision logic

**Completed:** `server/tests/bots.test.ts` covers:

- `randInt`, `roundUpToStep`, `currentMaxBid`, `highestBidEntry` — all helper edge cases
- `NaiveBotStrategy.decideAuction` — picks lowest-value goat, returns valid delay and id
- `NaiveBotStrategy.decideBid` — profitable/unprofitable paths, self-outbid guard, cash cap, chunked rounding, zero-value goat
- `NaiveBotStrategy.decideAccept` — threshold enforcement, held bid considered, highest-wins, positive delay
- `BotManager` — scheduling, key-replacement cancellation, cancel(), cancelAll(), pendingCount

---

### [ ] UI test: game with 1 human + bots completes successfully

**Description:** Playwright test that starts a game with a single human player (bots fill the other 4 seats) and plays until the score screen appears.

**Scenario:**
1. One browser opens the lobby, enters a name, creates a game
2. Player starts the game immediately (bots fill remaining seats)
3. Player bids or auctioneers for a few turns (fast-forward via TEST_MODE turn count)
4. Game ends; score screen shows all 5 players (bots included)
5. Player returns to lobby

**Acceptance criteria:**
- Test runs headlessly
- Score screen shows bot names (Bailey, Chester, etc.)
- No server errors during the bot-driven turns

---

## Slice 3.5: Game Balance & Bot Fixes

**Goal:** Fix several issues discovered during Slice 3 testing that affect gameplay quality and bot correctness. All changes are logic/data — no new UI needed.

---

### [ ] Add a 5th goat type

**Description:** The game currently has 4 goat types (Silly, Angry, Happy, Hungry). Add a 5th type to match the intended 5-player design where each player has a uniquely favoured type.

**Changes:**
- Add `Fluffy` (or chosen name) to `GoatType` enum in `shared/src/types.ts`
- Update `GOAT_TYPE_COUNT` constant in `shared/src/constants.ts`
- Update `dealHands` in `server/src/logic/dealing.ts` to distribute all 5 types
- Update `generateValueSheets` in `server/src/logic/valueSheets.ts` to cover 5 types (see value sheet task below)
- Update any tests that hard-code 4 goat types

**Acceptance criteria:**
- `npm run typecheck` passes
- `npm run test:unit` passes
- Each goat type appears in dealt hands

---

### [ ] Rebalance goat values to 50/40/30/20/10

**Description:** Current value sheets use 1–4, which is too small — bots and players can barely make profitable bids. Switch to 50/40/30/20/10 across 5 types.

**Changes:**
- Update `generateValueSheets` in `server/src/logic/valueSheets.ts`: each player gets a permutation of `[50, 40, 30, 20, 10]` assigned across the 5 goat types
- Ensure no two players share the same top value (see "unique top values" task below)
- Update `NaiveBotStrategy` profit buffer and bid increment constants to be proportional to the new value scale (e.g. buffer 15–30, increments 5–25 rounded to nearest 5)
- Update any unit tests that assert on specific value sheet numbers

**Acceptance criteria:**
- Value sheets always contain exactly the set {50, 40, 30, 20, 10} for each player
- Bot bidding is competitive and readable at the new scale
- `npm run test:unit` passes

---

### [ ] Guarantee unique favourite goat type per player

**Description:** With 5 players and 5 goat types, each player should value a different type most highly. Currently `generateValueSheets` uses cyclic permutations that can assign the same top value to multiple players in some configurations.

**Changes:**
- Redesign `generateValueSheets` so the 5 permutations of `[50, 40, 30, 20, 10]` are chosen such that for each goat type, exactly one player has that type as their #1 value (i.e. the 5 permutations form a Latin square on the top position)
- The simplest implementation: start with `[50,40,30,20,10]` and rotate by 1 for each player — `[40,30,20,10,50]`, `[30,20,10,50,40]`, etc. This guarantees all 5 types are someone's favourite and no two players share a top
- When `playerCount < 5`, still generate valid sheets (no duplicate tops among the players present)

**Acceptance criteria:**
- No two players in the same game have the same #1 goat type
- `generateValueSheets` unit tests assert this property

---

### [ ] Fix bots not bidding on human-auctioned goats

**Description:** Bots are currently only triggered to bid by `triggerBotBidders()` which is called from `openAuction`. However `openAuction` is only called when a bot is the auctioneer. When a **human** calls `handlePutUpForAuction`, it calls `openAuction` internally — but the bot bid timers may be cancelled by the subsequent `handlePlaceBid` / `handleAcceptBid` calls before they fire.

**Root cause:** `handlePlaceBid` calls `triggerBotBidders()` (re-schedules bots), but `handleAcceptBid` calls `endAuction()` which calls `botManager.cancelAll()`, clearing any pending bid timers before they fire. If the human accepts quickly (as in tests), bots never get a chance.

**Fix:**
- Verify that `triggerBotBidders()` IS called from `openAuction` when a human auctions (it is — but the timing is the problem)
- The real fix is to ensure bot bid decisions are evaluated BEFORE a human can accept. Consider: only call `cancelAll()` after the auction is resolved, not before. Or: track which bots have already evaluated and don't reschedule them unnecessarily.
- Alternatively (simpler): don't cancel bot bid timers in `cancelAll()` — instead, guard in `executeBotBid` that the auction is still open (already done) and that the bot isn't already outbid. This means bots will evaluate even after a human accepts, but the guard will return early harmlessly.
- Recommended approach: move `botManager.cancelAll()` out of `endAuction()` and instead call it only from `onDispose()` and `handleAuctionTimeout()`. Bot bid/accept timers will naturally no-op via their existing guards when the auction is closed.

**Acceptance criteria:**
- When a human auctions a goat, bots place bids before the human accepts
- Verified manually in dev (`npm run dev`) by observing bot bids appear in the auction panel

---

### [ ] Shuffle player turn order at game start

**Description:** Currently players are seated in join order (first to join is always auctioneer for turn 0). Shuffling the order at game start makes games less predictable and fairer.

**Changes:**
- After `fillWithBots()` and before `dealHands()` in `handleStartGame`, shuffle `this.gameState.players` array in place (Fisher-Yates)
- Reassign `hostPlayerId` after shuffle so it still points to the correct player object (match by id, not index)
- `currentAuctioneerIndex` remains 0 (now points to a random player)

**Acceptance criteria:**
- Over multiple game starts, the first auctioneer is not always the first human to join
- `hostPlayerId` still correctly identifies the original host after shuffle
- `npm run test:unit` passes (GameRoom tests may need minor index-assumption fixes)

---

## Slice 4: Polished Lobby & Waiting Room

*Stub — expand before implementing.*

- [ ] Waiting room screen between join and game start (shows seated players, bot indicators)
- [ ] Host-only "Start Game" button (with min player enforcement)
- [ ] Real-time player list updates in waiting room
- [ ] Disconnect handling (replace leaver with bot mid-game)
- [ ] UI test: waiting room flow

---

## Slice 5: Art, Animation & Polish

*Stub — expand before implementing.*

- [ ] Goat card art (Silly, Angry, Happy, Hungry — all 4 types)
- [ ] Idle animations per goat type (ear wiggle, blink, chew)
- [ ] UI skin: color palette, fonts, backgrounds
- [ ] Sound effects: bid placed, auction accepted, game end fanfare
- [ ] Visual feedback for bid accepted/rejected (animation or flash)
- [ ] Responsive layout (works at common browser window sizes)

---

## Backlog / Future

- [ ] Game configuration (turn count, starting cash, hand size)
- [ ] Additional goat types
- [ ] Player avatars
- [ ] Chat or emoji reactions during auctions
- [ ] Rematch / persistent player names
- [ ] Mobile layout
