# Negoatiations — Task Tracker

## Philosophy: Vertical Slices

Each slice delivers a **working, tested, playable build**. We never finish a slice without tests. We never start a new slice without the previous one being stable.

Status indicators:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

> Completed work from Slices 0–3.5 has been archived in `TASKS_ARCHIVE.md`.

---

## Active Tasks

The tasks below are bugs, balance issues, and UX improvements identified during playtesting. They are roughly ordered by impact on playability, but may be tackled in any order that makes sense given dependencies.

---

### [x] UI Bug: Score screen shows connection ID instead of player name

**Description:** The end-game score screen currently displays raw player IDs (Colyseus session IDs like `abc123def`) instead of human-readable names. This makes the score screen unreadable.

**Root cause:** The `gameOver` broadcast probably sends `scores` keyed by player ID, and the client renders the key directly rather than looking up the player's name.

**Changes:**
- Server already includes `playerNames: Record<string, string>` in the `gameOver` broadcast — verify this is being sent correctly
- Update `GameScene.ts` (or wherever the score screen is rendered) to look up each player ID in `playerNames` and display the name instead
- Fall back to the ID only if the name is missing (defensive)

**Acceptance criteria:**
- Score screen shows "Alice — 142 pts", "Bot Bailey — 88 pts", etc.
- No raw session IDs visible anywhere on the score screen
- Works for both human and bot players

**Completion note:** Runtime code (server broadcast + ScoreScene lookup) was already correct. Added `playerNames` to the `GameOverEvent` type in `shared/types.ts` and added assertions in `GameRoom.test.ts` to verify it's present and correct in the broadcast.

---

### [x] Game Bug: Turn counter increments per auction instead of per full round

**Description:** `TURNS_PER_GAME` is being compared against `turnNumber`, but `turnNumber` increments by 1 after each individual auction. In a 5-player game with `TURNS_PER_GAME = 3`, the game ends after only 3 auctions total — meaning 2 players never get a chance to be auctioneer in even the first round.

**Intended behaviour:** "3 turns" means every player auctions 3 times each. In a 5-player game, that is 15 auctions total (5 players × 3 turns).

**Fix:**
- **Preferred:** Change `isGameOver` to check full rounds: `Math.floor(turnNumber / playerCount) >= TURNS_PER_GAME`. This keeps the constant human-readable ("3 rounds per player").
- Update `isGameOver` in `server/src/logic/turns.ts` to accept `playerCount` as a second argument
- Update the call site in `GameRoom.ts` (`endAuction`) to pass `this.gameState.players.length`
- Update `TURNS_PER_GAME` constant comment to clarify it means "rounds per player, not total auctions"
- Update `turns.test.ts` to cover the new two-argument signature and add a test: "game is not over after first N auctions when there are 5 players"
- Update `TEST_MODE` logic — test mode should end after 1 full round (5 auctions) for speed, not after 4 individual auctions

**Acceptance criteria:**
- In a 5-player game with `TURNS_PER_GAME = 3`, exactly 15 auctions occur before game over
- Every player (human + bot) gets to be auctioneer exactly the same number of times
- `npm run test:unit` passes

**Completion note:** Changed `isGameOver(turnNumber, playerCount)` to use `Math.floor(turnNumber / playerCount) >= TURNS_PER_GAME`. Updated call site in `GameRoom.ts`. Changed `TURNS_PER_GAME` in TEST_MODE from 4 → 1 (1 full round = playerCount auctions, fast for tests). Updated `turns.test.ts` with new two-argument signature and added 5-player test. All 108 tests pass.

---

### [x] Balance: Players should start with one of each goat type

**Description:** Currently `dealHands` deals a randomly shuffled pool, so a player might receive three Silly goats and zero Grumpy goats. This creates unintended luck variance and makes strategy harder — your value sheet is meaningless if you never draw the goat type you value most.

**Intended behaviour:** Every player's starting hand contains exactly one of each goat type: one Silly, one Angry, one Happy, one Hungry, one Grumpy. All players start on equal footing and every goat type in the value sheet is relevant from turn 1.

**Changes:**
- Rewrite `dealHands` in `server/src/logic/dealing.ts`: construct each hand as one goat of each type with a unique ID, e.g. `Object.values(GoatType).map((type, i) => ({ id: \`goat-p${playerIdx}-${i}\`, type }))`
- Remove the old modulo-based shuffle pool — it's no longer needed
- Update `dealing.test.ts`: replace "distributes goat types evenly" (trivially true by construction) with "each hand contains exactly one of each goat type"

**Acceptance criteria:**
- Every player starts with exactly one Silly, one Angry, one Happy, one Hungry, one Grumpy
- `npm run test:unit` passes
- `npm run typecheck` passes

**Completion note:** Replaced pool/shuffle with deterministic per-player construction: one of each GoatType per hand. Updated `dealing.test.ts` to assert exactly one of each type per hand (not just even global distribution). All 108 tests pass.

---

### [x] Bot Issue: Bots should use Hold and Reject during auctions

**Description:** When a bot is the auctioneer, it currently only accepts or waits. Real auctioneers should also hold promising bids (to signal interest and buy time) and reject bids that fall below a floor price. This makes bot auctions feel more alive and teaches human players that those mechanics exist.

**Changes:**
- Expand `AcceptAction` in `BotStrategy.ts` to support `action: 'accept' | 'hold' | 'reject' | 'wait'`
- Update `NaiveBotStrategy.decideAccept` with three tiers:
  - **Reject** bids below ~30% of the goat's value — prompt bidders to raise
  - **Hold** bids between ~30% and the profit threshold — signals "this is interesting, keep going"
  - **Accept** bids at or above the profit threshold (existing logic, but now delayed until near timer — see timing task below)
  - **Wait** when there are no open bids
- Add `executeBotHold` and `executeBotReject` methods to `GameRoom.ts` (analogous to `executeBotAccept`), calling the existing `handleHoldBid` and `handleRejectBid` internal logic
- Wire the new actions into `triggerBotAuctioneerAccept`
- Update `bots.test.ts` to cover hold and reject branches

**Acceptance criteria:**
- Bot auctioneers hold bids on mid-range offers
- Bot auctioneers reject clearly low-ball bids
- `npm run test:unit` passes

**Completion note:** Extended `AcceptAction` type to `'accept' | 'hold' | 'reject' | 'wait'`. Implemented three-tier logic in `NaiveBotStrategy.decideAccept`: reject (<30% value), hold (30–70%), accept (≥70%). Added `executeBotHold` and `executeBotReject` to `GameRoom.ts`. Updated `triggerBotAuctioneerAccept` to dispatch all four action types. Updated tests; 109 pass.

---

### [x] Bot Issue: Bots should wait until near timer expiry to accept

**Description:** Bot auctioneers currently accept qualifying bids after a short random delay (1.5–5s). This makes bot auctions feel rushed and doesn't give human bidders time to counter. Auctioneers should milk the drama.

**Intended behaviour:**
1. When a bid crosses the hold threshold, hold it quickly (1–3s delay) to signal interest
2. Only accept (or move from hold to accept) in the final 2–3 seconds of the auction timer
3. If a better bid arrives while holding, re-evaluate immediately

**Changes:**
- In `NaiveBotStrategy.decideAccept` (and/or in `GameRoom.triggerBotAuctioneerAccept`), compute `delayMs = (auction.timerEndsAt - Date.now()) - randInt(1500, 3000)` for accept actions
- Guard `delayMs < 500` → accept immediately (timer nearly expired)
- The hold action keeps a short delay (1–3s) so it happens quickly once a good bid arrives
- Update `bots.test.ts` timing assertions to reflect the new delay logic

**Acceptance criteria:**
- Bot auctions visibly run most of their timer before the accept fires
- Bot still accepts promptly when the timer is nearly expired
- Combines cleanly with the Hold/Reject task above (implement together or in order)

**Completion note:** Implemented as part of the Hold/Reject task. Accept delay is `Math.max(500, timerEndsAt - now - randInt(1500, 3000))`, so bot waits until 1.5–3 s before timer expiry to accept. Test verifies delay > 24 s for a 30 s timer.

---

### [x] UX: Animate bid accepted, rejected, and held feedback

**Description:** When the auctioneer accepts, rejects, or holds a bid, the bidder currently gets no visual feedback beyond the state updating. This makes the game feel unresponsive.

**Animations to add:**
- **Accepted:** Green flash on the bid entry + brief "✓ Accepted!" text pop; lead into the goods-transfer animation (see next task)
- **Rejected:** Red shake animation on the bid entry + "✗ Rejected" text; bid entry disappears with a dismissive effect
- **Held:** Amber/yellow highlight on the bid entry; a small lock icon or "On hold" label appears

**Changes:**
- Detect bid state transitions by diffing old vs new auction state on each `stateUpdate`
- Add Phaser tween helpers in `GameScene.ts` or a new `client/src/ui/BidAnimations.ts`
- Keep animations short (300–500ms) so they don't slow gameplay
- Ensure animations fire for all observers (not just the affected bidder), since it's visible to everyone

**Acceptance criteria:**
- All three transitions have a distinct, non-confusable animation
- Animations trigger correctly from every player's perspective
- No animation plays twice for the same event (guard against duplicate state updates)

**Completion note:** Diffing logic in `stateUpdate` handler detects open→held (amber) and open→gone (rejected, red) transitions. `recentlyHeldBidderId` triggers an amber border pulse on the held bid row; cleared via tween `onComplete`. `recentlyRejectedBidderIds` triggers a red flash overlay above the open bids section; cleared on tween complete. Screen-level flashes for accept/reject still fire from existing `bidAccepted`/`bidRejected` messages.

---

### [x] UX: Announce auction winner and animate goods transfer

**Description:** When an auction is accepted, there is no clear announcement of who won, what they paid, or what goat changed hands. This is the most important moment in the game and should be celebrated.

**What to show:**
- A center-screen banner for 2–3 seconds: "Bailey sold a Grumpy Goat to Alice for 35 gold!" — then fade out
- A goat-card token animating from the seller's position to the buyer's position on the player circle
- Cash counter animations: numbers tick down on the buyer and up on the seller simultaneously
- For no-sale (timer expired, no held bid): a brief "No sale — goat kept!" message

**Changes:**
- Detect auction-accepted vs auction-timeout transitions in `GameScene.ts` by diffing state
- Build a `showAuctionResult(seller, buyer, goat, price)` method that orchestrates banner + token tween + cash tick
- Goat token tween: use the player circle node positions as source/destination (see player circle task)
- Cash tick: Phaser number interpolation tween on the cash display text objects

**Acceptance criteria:**
- Every accepted auction triggers the announcement banner and animations
- Goat visibly "moves" to the new owner
- Cash displays update with a tick animation
- No-sale auctions show a "No sale" message instead

**Completion note:** Detects auction→null transitions in `stateUpdate`; determines sale vs no-sale by checking if seller lost the goat. Shows a dark banner (fade in → hold 2s → fade out) with sale summary or "No sale — goat kept!" message. On sale: tweens a colored goat token from seller player circle node to buyer node (using `playerNodePositions` from Task 7). Cash values update in real time on next stateUpdate via player circle node text.

---

### [x] UX: Players displayed in a circle around the auction table

**Description:** Currently players are shown in a flat right-side list. Instead, all players should be arranged in a circle around a central auction table, making the social dynamic of the game visually clear.

**Layout rules:**
- The local player (you) is always anchored at the bottom-center of the circle
- Other players are arranged clockwise in turn order from the current player's left
- The active auctioneer is visually highlighted (glowing border, raised card, or spotlight)
- Each player node shows: avatar placeholder, name, cash balance, and goat-count badge

**Changes:**
- Replace the right-side player list panel in `GameScene.ts` with a `PlayerCircle` component (`client/src/ui/PlayerCircle.ts`)
- Compute node positions based on canvas dimensions and player count; use Phaser `Container` for each node so they can animate independently
- On each `stateUpdate`, update cash/goat-count text and reapply the auctioneer highlight
- Clockwise ordering is relative to the local player's position — recompute seat layout whenever `myPlayerIndex` is determined

**Acceptance criteria:**
- All 5 player nodes are visible and arranged in a circle
- Local player is always at the bottom
- Active auctioneer is visually distinct
- Name, cash, and goat count update in real time on every state update

**Completion note:** Added `playerCircleContainer` and `playerNodePositions` (Map for Task 9 tween). Removed PLAYERS panel from `buildRightPanel`. Added `buildPlayerCircle` that computes ellipse positions (CX=638, CY=center, RX=350, RY=220) with local player at bottom (π/2), others clockwise. Auctioneer node gets gold glow + scale pulse tween. Right panel now shows only YOUR VALUES (full height).

---

### [x] UX: Prominent "Your Turn to Auction" indicator

**Description:** When it's your turn to put a goat up for auction, the center of the screen currently shows a generic "Waiting for auction" message. Players miss that it's their turn.

**What to show:**
- Replace the idle center-screen message with a large, animated "Your Turn!" banner in a distinct color (gold/yellow vs the neutral grey of the waiting state)
- Include a clear sub-instruction: "Select a goat from your hand to start the auction"
- Goat cards in your hand should visually "light up" or pulse to indicate they're clickable
- The banner should pulse gently (alpha tween) to draw the eye without being annoying

**Changes:**
- In `GameScene.ts`, detect the condition: `phase === 'playing' && auction === null && currentAuctioneerIndex === myPlayerIndex`
- Render a distinct "my turn" center panel vs the "waiting" panel
- Add a pulse tween (scale or alpha) to the banner
- Update hand card rendering to show a hover/selection affordance on the player's own turn

**Acceptance criteria:**
- "Your Turn" state is visually unmistakable
- Instruction text is legible
- Hand cards have a clear clickable affordance during the player's auction turn
- Indicator disappears immediately when an auction opens

**Completion note:** `buildWaitingCenter` now takes `isMyTurn` arg; shows a gold "Your Turn!" banner with pulsing alpha tween and sub-instruction when it's the player's turn. Hand panel draws gold glow rings (pulsing tween) behind each card while it's the player's turn and no auction is active.

---

### [x] UX Controls: Replace bid number input with +1 / +5 / Raise / Clear buttons

**Description:** The current bid interface uses a raw number input, which is fiddly and awkward for a real-time auction game. Replace it with tactile increment buttons.

**Button set:**
- **+1** — adds 1 gold to the current bid draft
- **+5** — adds 5 gold to the current bid draft
- **Raise** — sets the bid draft to `currentHighestBid + 1` (the minimum to beat the current leader); if no bids yet, sets to 1
- **✕ Clear** — resets the draft to 0 (only shown when draft > 0)
- **Bid** (submit) — sends `PlaceBid` with the current draft; disabled when draft ≤ currentHighestBid or draft > player.cash

**Display:**
- Show draft value prominently: "Your bid: 35 gold"
- Show current highest bid for reference: "Current high: 30 (Bob)"
- Grey out +1 / +5 when adding that amount would exceed the player's cash

**Changes:**
- Replace the number input and "Place Bid" button in `GameScene.ts` with the new button layout (DOM overlay or Phaser interactive objects)
- Maintain a local `bidDraft: number` state in the scene; reset to 0 when a new auction opens or the player's bid is confirmed
- Validate and visually disable the submit button when the draft is invalid

**Acceptance criteria:**
- All buttons render and function correctly
- Draft display updates immediately on every button press
- Submit is disabled when draft is invalid (too low or exceeds cash)
- Raise correctly computes `currentHighestBid + 1`
- Draft resets cleanly between auctions

**Completion note:** Removed `<input>` DOM overlay; replaced with Phaser buttons (+1, +5, Raise, ✕ Clear). Draft tracked in `bidDraft` field; auto-reset on new auction via `lastAuctionGoatId` diff. Bid button enabled only when `bidDraft > currentHighCash && bidDraft <= myPlayer.cash`. All typecheck clean.

---

### [x] UX: Score screen shows full breakdown (goats by type + cash)

**Description:** The current end-game score screen shows only a final total score per player. Players have no way to understand *why* they won or lost — which goats they ended up with, how much each type was worth to them, and how much cash contributed. A full breakdown makes the reveal exciting and teaches players what the winning strategy was.

**What to show (per player):**
- Player name and final total score (existing)
- **Cash remaining** — raw gold at game end, labeled "Cash: 42 gold"
- **Goats by type** — a row for each goat type showing: type name, count held, value per goat (from their private value sheet), and subtotal. E.g.: "Silly × 2 @ 50 = 100 pts"
- **Grand total** breakdown: cash + all goat subtotals = final score (should match the existing score)
- Reveal each player's value sheet alongside their breakdown so everyone can see the full picture at game end

**Layout suggestion:**
- A "scorecard" accordion or tab per player: click/tap to expand their breakdown, collapsed by default for opponents
- Your own card is expanded by default
- Each goat type row uses the goat's color for a visual type indicator

**Changes:**
- The server already sends `valueSheets` and `scores` in the `gameOver` broadcast — also ensure `playerNames` is included (already added in Slice 3)
- Extend the client's score screen rendering to display the breakdown, computing `goatCount[type] * valueSheet[type]` for each type locally in the client (no server changes needed)
- Add the cash row and per-type rows for each player
- Style the scorecard with readable typography; highlight the winner's card

**Acceptance criteria:**
- Each player's scorecard shows: cash, goats by type with count/value/subtotal, and grand total
- Grand total on the scorecard matches the server-computed score
- All players' value sheets are visible on the score screen
- The winner is visually highlighted

**Completion note:** Added `finalPlayers` (id, name, hand, cash) to `GameOverEvent` type and server broadcast. ScoreScene rewritten with accordion cards (click to expand/collapse); my card expanded by default. Each expanded card shows: cash row, per-type goat rows (count × value = subtotal), grand total. Winner card gold-highlighted.

---

## Backlog / Future

- [ ] Game configuration screen (turn count, starting cash, hand size)
- [ ] Player avatars
- [ ] Chat or emoji reactions during auctions
- [ ] Rematch / persistent player names
- [ ] Mobile layout
- [ ] Disconnect handling (replace leaver with bot mid-game)
- [ ] Goat card art and idle animations per type
- [ ] Sound effects (bid placed, accepted, game end fanfare)
