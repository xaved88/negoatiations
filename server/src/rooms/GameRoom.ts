import { Room, Client } from 'colyseus';
import {
  GameState,
  PlayerState,
  ValueSheet,
  Bid,
  BidEntry,
  AuctionState,
} from 'shared/types';
import {
  STARTING_CASH,
  GOATS_PER_PLAYER,
  MAX_PLAYERS,
  AUCTION_TIMER_SECONDS,
  BID_LOCK_SECONDS,
} from 'shared/constants';
import { dealHands } from '../logic/dealing';
import { generateValueSheets } from '../logic/valueSheets';
import { validateBid, applyAcceptedBid, applyRejectedBid } from '../logic/bidding';
import { nextAuctioneerIndex, isGameOver } from '../logic/turns';
import { computeScores } from '../logic/scoring';
import { BotManager } from '../bots/BotManager';
import { BotStrategy } from '../bots/BotStrategy';
import { NaiveBotStrategy } from '../bots/NaiveBotStrategy';
import { randInt } from '../bots/NaiveBotStrategy';

// Bot display names — cycled if more bots than names
const BOT_NAMES = ['Bailey', 'Chester', 'Daisy', 'Earl', 'Fern'];

// We manage state as a plain object and broadcast it manually via messages.
// We deliberately do NOT call this.setState() because Colyseus's binary Schema
// serializer requires @Schema-decorated classes, not plain objects.
// All clients receive state via 'stateUpdate' messages instead.
export class GameRoom extends Room {
  private gameState!: GameState; // assigned in onCreate() before any other method is called
  private hostClientId: string | null = null;
  private playerValueSheets: Record<string, ValueSheet> = {};
  private clientIdToPlayerId: Record<string, string> = {};
  private auctionTimer: ReturnType<typeof setTimeout> | null = null;

  // Bot infrastructure
  private botManager: BotManager = new BotManager();
  private botStrategies: Map<string, BotStrategy> = new Map();

  onCreate() {
    this.gameState = {
      players: [],
      phase: 'lobby',
      currentAuctioneerIndex: 0,
      auction: null,
      turnNumber: 0,
      scores: null,
      hostPlayerId: null,
    };

    this.maxClients = 5;

    this.onMessage('RequestState', (client: Client) => {
      // Client calls this once its scene listeners are ready so it doesn't miss
      // the initial stateUpdate that was sent during onJoin.
      client.send('stateUpdate', this.gameState);
    });

    this.onMessage('StartGame', (client: Client) => {
      this.handleStartGame(client);
    });

    this.onMessage('PutUpForAuction', (client: Client, data: { goatId: string }) => {
      this.handlePutUpForAuction(client, data);
    });

    this.onMessage('PlaceBid', (client: Client, data: { bid: Bid }) => {
      this.handlePlaceBid(client, data);
    });

    this.onMessage('AcceptBid', (client: Client, data: { bidderId: string }) => {
      this.handleAcceptBid(client, data);
    });

    this.onMessage('HoldBid', (client: Client, data: { bidderId: string }) => {
      this.handleHoldBid(client, data);
    });

    this.onMessage('RejectBid', (client: Client, data: { bidderId: string }) => {
      this.handleRejectBid(client, data);
    });

    this.onMessage('RetractBid', (client: Client) => {
      this.handleRetractBid(client);
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const playerName = options?.name || `Player ${this.gameState.players.length + 1}`;

    if (this.hostClientId === null) {
      this.hostClientId = client.sessionId;
    }

    // Use the Colyseus sessionId directly as the player ID.
    // This means the client can identify itself via room.sessionId without
    // needing a separate 'yourPlayerId' message (which would race Phaser init).
    const playerId = client.sessionId;
    this.clientIdToPlayerId[client.sessionId] = playerId;

    const newPlayer: PlayerState = {
      id: playerId,
      name: playerName,
      hand: [],
      cash: STARTING_CASH,
      isBot: false,
    };

    this.gameState.players.push(newPlayer);

    if (this.gameState.players.length === 1) {
      this.gameState.hostPlayerId = playerId;
      this.setMetadata({ hostName: playerName });
    }

    // Send the full current state to the newly joined client
    client.send('stateUpdate', this.gameState);
    // Broadcast updated state (new player count) to everyone else
    this.broadcast('stateUpdate', this.gameState, { except: client });
  }

  onLeave(client: Client) {
    const playerId = this.clientIdToPlayerId[client.sessionId];
    const playerIdx = this.gameState.players.findIndex((p) => p.id === playerId);
    if (playerIdx >= 0) {
      this.gameState.players.splice(playerIdx, 1);
      this.broadcastState();
    }
  }

  onDispose() {
    // Clean up all pending bot timers when the room is destroyed
    this.botManager.cancelAll();
    this.clearAuctionTimer();
  }

  // ---------------------------------------------------------------------------
  // Human player message handlers
  // ---------------------------------------------------------------------------

  private handleStartGame(client: Client) {
    if (this.gameState.phase !== 'lobby') return;
    if (this.gameState.players.length < 2) return;
    // Only the host (first player to join) may start the game
    if (client.sessionId !== this.hostClientId) return;

    // 1. Fill empty seats with bots so every game has MAX_PLAYERS participants
    this.fillWithBots();

    // 1b. Shuffle the player order so turn order is randomised each game
    this.gameState.players = this.shufflePlayers(this.gameState.players);

    // 2. Deal hands for ALL players (humans + bots)
    const hands = dealHands(this.gameState.players.length, GOATS_PER_PLAYER);
    for (let i = 0; i < this.gameState.players.length; i++) {
      this.gameState.players[i].hand = hands[i];
    }

    // 3. Generate value sheets for ALL players
    const sheets = generateValueSheets(this.gameState.players.length);
    for (let i = 0; i < this.gameState.players.length; i++) {
      this.playerValueSheets[this.gameState.players[i].id] = sheets[i];
    }

    // 4. Instantiate a strategy for each bot
    for (const player of this.gameState.players) {
      if (player.isBot) {
        this.botStrategies.set(player.id, new NaiveBotStrategy());
      }
    }

    this.gameState.phase = 'playing';
    this.gameState.currentAuctioneerIndex = 0;
    this.gameState.turnNumber = 0;

    // Send value sheets privately — each human client only sees their own
    for (const clientSession of this.clients) {
      const playerId = this.clientIdToPlayerId[clientSession.sessionId];
      const sheet = this.playerValueSheets[playerId];
      if (sheet) {
        clientSession.send('yourValueSheet', sheet);
      }
    }

    this.broadcastState();

    // 5. If the first auctioneer is a bot, kick off its turn
    this.scheduleIfBotTurn();
  }

  private handlePutUpForAuction(client: Client, data: { goatId: string }) {
    if (this.gameState.phase !== 'playing' || this.gameState.auction !== null) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;

    const playerIdx = this.gameState.players.findIndex((p) => p.id === playerId);
    if (playerIdx !== this.gameState.currentAuctioneerIndex) return;

    this.openAuction(playerId, data.goatId);
  }

  private handlePlaceBid(client: Client, data: { bid: Bid }) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;
    if (playerId === this.gameState.auction.auctioneerPlayerId) return;

    const bidder = this.gameState.players.find((p) => p.id === playerId);
    if (!bidder) return;

    const bid = data.bid;
    if (!validateBid(bid, bidder)) return;

    this.recordBid(playerId, bid);
    this.broadcastState();

    // Re-evaluate bot bidders (someone new bid — they might want to respond)
    // and give the auctioneer bot a chance to accept
    this.triggerBotBidders();
    this.triggerBotAuctioneerAccept();
  }

  private handleAcceptBid(client: Client, data: { bidderId: string }) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;
    if (playerId !== this.gameState.auction.auctioneerPlayerId) return;

    // The accepted bid can be either an open bid (bids[]) or the held bid
    const bidEntry =
      this.gameState.auction.bids.find((b) => b.bidderId === data.bidderId) ??
      (this.gameState.auction.heldBid?.bidderId === data.bidderId
        ? this.gameState.auction.heldBid
        : undefined);
    if (!bidEntry) return;

    const auctioneerIdx = this.gameState.players.findIndex((p) => p.id === playerId);
    const bidderIdx = this.gameState.players.findIndex(
      (p) => p.id === data.bidderId
    );
    if (auctioneerIdx < 0 || bidderIdx < 0) return;

    const [updatedAuctioneer, updatedBidder] = applyAcceptedBid(
      this.gameState.players[auctioneerIdx],
      this.gameState.players[bidderIdx],
      this.gameState.auction.goatOnOffer,
      bidEntry.bid
    );

    this.gameState.players[auctioneerIdx] = updatedAuctioneer;
    this.gameState.players[bidderIdx] = updatedBidder;

    this.clearAuctionTimer();
    this.endAuction();
  }

  private handleHoldBid(client: Client, data: { bidderId: string }) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;
    if (playerId !== this.gameState.auction.auctioneerPlayerId) return;

    // The bid to hold must be an open bid in bids[]
    const bidIdx = this.gameState.auction.bids.findIndex(
      (b) => b.bidderId === data.bidderId
    );
    if (bidIdx < 0) return;

    // If a bid is already held, drop it to free the slot — the previous
    // holder's open-bid slot is unaffected since the two slots are separate.
    this.gameState.auction.heldBid = null;

    // Move the new bid out of bids[] into the dedicated heldBid slot
    const [heldEntry] = this.gameState.auction.bids.splice(bidIdx, 1);
    this.gameState.auction.heldBid = heldEntry;
    this.broadcastState();

    // Bids changed — give bidder bots a chance to respond
    this.triggerBotBidders();
  }

  private handleRejectBid(client: Client, data: { bidderId: string }) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;
    if (playerId !== this.gameState.auction.auctioneerPlayerId) return;

    // Held bids cannot be rejected — they only live in heldBid, not in bids[],
    // so this filter only ever touches open bids anyway.
    this.gameState.auction.bids = applyRejectedBid(
      this.gameState.auction.bids,
      data.bidderId
    );

    this.broadcastState();

    // Rejected player may re-bid; also re-trigger all bot bidders
    this.triggerBotBidders();
  }

  private handleRetractBid(client: Client) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;

    // Auctioneers cannot retract (they don't bid)
    if (playerId === this.gameState.auction.auctioneerPlayerId) return;

    // Only open bids (in bids[]) can be retracted — held bid cannot be retracted
    const bidEntry = this.gameState.auction.bids.find((b) => b.bidderId === playerId);
    if (!bidEntry) return;

    // Cannot retract during the lock window
    const placedAt = bidEntry.bidPlacedAt ?? 0;
    if (Date.now() - placedAt < BID_LOCK_SECONDS * 1000) return;

    this.gameState.auction.bids = applyRejectedBid(this.gameState.auction.bids, playerId);
    this.broadcastState();

    // A bid was removed — re-evaluate whether the auctioneer bot wants to react
    this.triggerBotAuctioneerAccept();
  }

  // ---------------------------------------------------------------------------
  // Auction lifecycle helpers
  // ---------------------------------------------------------------------------

  /**
   * Opens an auction for the given auctioneer and goat.
   * Shared by human `handlePutUpForAuction` and bot `executeBotPutUpForAuction`.
   */
  private openAuction(auctioneerPlayerId: string, goatId: string) {
    const playerIdx = this.gameState.players.findIndex(
      (p) => p.id === auctioneerPlayerId
    );
    if (playerIdx < 0) return;
    const player = this.gameState.players[playerIdx];
    const goat = player.hand.find((g) => g.id === goatId);
    if (!goat) return;

    const timerEndsAt = Date.now() + AUCTION_TIMER_SECONDS * 1000;

    const auction: AuctionState = {
      auctioneerPlayerId,
      goatOnOffer: goat,
      bids: [],
      heldBid: null,
      status: 'open',
      timerEndsAt,
    };

    this.gameState.auction = auction;

    // Start the auction timer
    this.auctionTimer = setTimeout(() => {
      this.handleAuctionTimeout();
    }, AUCTION_TIMER_SECONDS * 1000);

    this.broadcastState();

    // Trigger bot bidders (all bots that are NOT the auctioneer)
    this.triggerBotBidders();
    // Also give the auctioneer bot a chance to re-evaluate if there are stale bids
    // (shouldn't be any on open, but harmless to call)
    this.triggerBotAuctioneerAccept();
  }

  /**
   * Records a bid for the given player, replacing any existing open bid.
   * Used by both human-path (handlePlaceBid) and bot path (executeBotBid).
   */
  private recordBid(bidderId: string, bid: Bid) {
    if (!this.gameState.auction) return;
    // Replace any existing open bid from this player
    this.gameState.auction.bids = this.gameState.auction.bids.filter(
      (b) => b.bidderId !== bidderId
    );
    const entry: BidEntry = { bidderId, bid, bidPlacedAt: Date.now() };
    this.gameState.auction.bids.push(entry);
  }

  private handleAuctionTimeout() {
    if (!this.gameState.auction || this.gameState.phase !== 'playing') return;

    // Cancel any pending bot accept timer — we're resolving the auction now
    const auctioneerBotId = this.gameState.auction.auctioneerPlayerId;
    this.botManager.cancel(`accept-${auctioneerBotId}`);

    const auction = this.gameState.auction;

    // If there's a held bid, auto-accept it on timer expiry
    if (auction.heldBid) {
      const bidEntry = auction.heldBid;
      const auctioneerIdx = this.gameState.players.findIndex(
        (p) => p.id === auction.auctioneerPlayerId
      );
      const bidderIdx = this.gameState.players.findIndex(
        (p) => p.id === bidEntry.bidderId
      );
      if (auctioneerIdx >= 0 && bidderIdx >= 0) {
        const [updatedAuctioneer, updatedBidder] = applyAcceptedBid(
          this.gameState.players[auctioneerIdx],
          this.gameState.players[bidderIdx],
          auction.goatOnOffer,
          bidEntry.bid
        );
        this.gameState.players[auctioneerIdx] = updatedAuctioneer;
        this.gameState.players[bidderIdx] = updatedBidder;
      }
    }
    // Whether or not there was a held bid, the auction ends (no-sale if no held bid)
    this.auctionTimer = null;
    this.endAuction();
  }

  private clearAuctionTimer() {
    if (this.auctionTimer !== null) {
      clearTimeout(this.auctionTimer);
      this.auctionTimer = null;
    }
  }

  /**
   * Clears auction state, advances the turn, checks for game over, and broadcasts.
   * Call this after the exchange (if any) has already been applied to player states.
   */
  private endAuction() {
    // NOTE: we do NOT call botManager.cancelAll() here because doing so would
    // cancel pending bid timers from bots who haven't acted yet on the current
    // auction. Instead, each bot action callback re-checks phase/auction guards
    // and silently no-ops if the auction is already over.
    // cancelAll() is reserved for onDispose() only.

    this.gameState.auction = null;
    this.gameState.turnNumber++;
    this.gameState.currentAuctioneerIndex = nextAuctioneerIndex(
      this.gameState.currentAuctioneerIndex,
      this.gameState.players.length
    );

    if (isGameOver(this.gameState.turnNumber)) {
      const scores = computeScores(this.gameState.players, this.playerValueSheets);
      this.gameState.phase = 'ended';
      this.gameState.scores = scores;

      this.broadcast('gameOver', {
        scores,
        valueSheets: this.playerValueSheets,
      });
    }

    this.broadcastState();

    // If the next auctioneer is a bot (and the game isn't over), schedule its turn
    if (this.gameState.phase === 'playing') {
      this.scheduleIfBotTurn();
    }
  }

  private broadcastState() {
    this.broadcast('stateUpdate', this.gameState);
  }

  // ---------------------------------------------------------------------------
  // Bot seat management
  // ---------------------------------------------------------------------------

  /**
   * Fill empty seats with bot players up to MAX_PLAYERS.
   * Called once in handleStartGame, before hands are dealt.
   */
  private fillWithBots() {
    let botNameIdx = 0;
    while (this.gameState.players.length < MAX_PLAYERS) {
      const botId = `bot-${Date.now()}-${botNameIdx}`;
      const botPlayer: PlayerState = {
        id: botId,
        name: `Bot ${BOT_NAMES[botNameIdx % BOT_NAMES.length]}`,
        hand: [],
        cash: STARTING_CASH,
        isBot: true,
      };
      this.gameState.players.push(botPlayer);
      botNameIdx++;
    }
  }

  /**
   * Fisher-Yates shuffle — returns a new array with elements in random order.
   * Used to randomise the player turn order at game start.
   */
  private shufflePlayers<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ---------------------------------------------------------------------------
  // Bot action scheduling
  // ---------------------------------------------------------------------------

  /**
   * If the current auctioneer is a bot and no auction is in progress, schedule
   * the bot to put up a goat. If the bot has no goats (edge case), skip the turn.
   */
  private scheduleIfBotTurn() {
    if (this.gameState.phase !== 'playing' || this.gameState.auction !== null) return;

    const auctioneer = this.gameState.players[this.gameState.currentAuctioneerIndex];
    if (!auctioneer?.isBot) return;

    // Edge case: bot has no goats — skip their turn to avoid a stall
    if (auctioneer.hand.length === 0) {
      // Advance without creating an auction
      this.endAuction();
      return;
    }

    const strategy = this.botStrategies.get(auctioneer.id);
    const valueSheet = this.playerValueSheets[auctioneer.id];
    if (!strategy || !valueSheet) return;

    const decision = strategy.decideAuction(auctioneer, valueSheet);
    this.botManager.schedule(`auction-${auctioneer.id}`, decision.delayMs, () => {
      this.executeBotPutUpForAuction(auctioneer.id, decision.goatId);
    });
  }

  /**
   * Schedule each non-auctioneer bot to evaluate whether to place a bid.
   * Replaces any existing pending bid timer for each bot (so they re-evaluate
   * from scratch based on the current auction state when their timer fires).
   *
   * @param excludeBotId - optionally skip rescheduling one bot (e.g. the one
   *   that just bid, to give a brief cooldown before it can outbid again).
   */
  private triggerBotBidders(excludeBotId?: string) {
    if (!this.gameState.auction || this.gameState.phase !== 'playing') return;
    const auctioneerPlayerId = this.gameState.auction.auctioneerPlayerId;

    for (const player of this.gameState.players) {
      if (!player.isBot) continue;
      if (player.id === auctioneerPlayerId) continue;
      if (player.id === excludeBotId) continue;

      // Random delay so bots don't all fire simultaneously
      const delay = randInt(1_500, 5_000);
      this.botManager.schedule(`bid-${player.id}`, delay, () => {
        this.executeBotBid(player.id);
      });
    }
  }

  /**
   * If the current auctioneer is a bot, re-evaluate whether to accept a bid.
   * Cancels any previous pending accept timer first so we always work from
   * the freshest auction state.
   */
  private triggerBotAuctioneerAccept() {
    if (!this.gameState.auction || this.gameState.phase !== 'playing') return;

    const auction = this.gameState.auction;
    const auctioneer = this.gameState.players.find(
      (p) => p.id === auction.auctioneerPlayerId
    );
    if (!auctioneer?.isBot) return;

    const strategy = this.botStrategies.get(auctioneer.id);
    const valueSheet = this.playerValueSheets[auctioneer.id];
    if (!strategy || !valueSheet) return;

    const decision = strategy.decideAccept(auctioneer, valueSheet, auction);
    if (decision.action !== 'accept' || !decision.bidderId) return;

    // Cancel the old accept timer and set a fresh one
    const bidderId = decision.bidderId;
    this.botManager.schedule(`accept-${auctioneer.id}`, decision.delayMs, () => {
      this.executeBotAccept(auctioneer.id, bidderId);
    });
  }

  // ---------------------------------------------------------------------------
  // Bot action execution (called from timer callbacks)
  // ---------------------------------------------------------------------------

  /**
   * Bot puts a goat up for auction. Guards against stale state (e.g. the
   * auction was already opened by a race or the game ended).
   */
  private executeBotPutUpForAuction(botId: string, goatId: string) {
    if (this.gameState.phase !== 'playing' || this.gameState.auction !== null) return;

    const playerIdx = this.gameState.players.findIndex((p) => p.id === botId);
    if (playerIdx < 0) return;
    if (playerIdx !== this.gameState.currentAuctioneerIndex) return;

    // Verify the goat is still in the bot's hand (could have changed from a previous turn)
    const player = this.gameState.players[playerIdx];
    const goat = player.hand.find((g) => g.id === goatId);

    if (!goat) {
      // Goat is gone — pick a different one if available, else skip
      if (player.hand.length === 0) {
        this.endAuction();
        return;
      }
      const fallbackGoat = player.hand[0];
      this.openAuction(botId, fallbackGoat.id);
      return;
    }

    this.openAuction(botId, goatId);
  }

  /**
   * Bot evaluates whether to place a bid right now, and does so if worthwhile.
   * All guards are re-checked at execution time to handle state changes since
   * the timer was set.
   */
  private executeBotBid(botId: string) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const auction = this.gameState.auction;
    if (auction.auctioneerPlayerId === botId) return;

    const player = this.gameState.players.find((p) => p.id === botId);
    if (!player) return;

    const strategy = this.botStrategies.get(botId);
    const valueSheet = this.playerValueSheets[botId];
    if (!strategy || !valueSheet) return;

    const decision = strategy.decideBid(player, valueSheet, auction, this.gameState.players);
    if (decision.action !== 'bid' || !decision.bid) return;

    const bid = decision.bid;
    if (!validateBid(bid, player)) return;

    this.recordBid(botId, bid);
    this.broadcastState();

    // Re-trigger other bidder bots (skip this one briefly — it just bid)
    // and let the auctioneer bot re-evaluate
    this.triggerBotBidders(botId);
    this.triggerBotAuctioneerAccept();
  }

  /**
   * Bot auctioneer accepts the given bid. Re-validates everything to guard
   * against the bid having been retracted or the auction having closed.
   */
  private executeBotAccept(auctioneerBotId: string, bidderId: string) {
    if (this.gameState.phase !== 'playing' || !this.gameState.auction) return;

    const auction = this.gameState.auction;
    if (auction.auctioneerPlayerId !== auctioneerBotId) return;

    // Find the bid (could be in open bids or held bid)
    const bidEntry =
      auction.bids.find((b) => b.bidderId === bidderId) ??
      (auction.heldBid?.bidderId === bidderId ? auction.heldBid : undefined);
    if (!bidEntry) return; // bid was retracted or never existed

    const auctioneerIdx = this.gameState.players.findIndex(
      (p) => p.id === auctioneerBotId
    );
    const bidderIdx = this.gameState.players.findIndex((p) => p.id === bidderId);
    if (auctioneerIdx < 0 || bidderIdx < 0) return;

    const [updatedAuctioneer, updatedBidder] = applyAcceptedBid(
      this.gameState.players[auctioneerIdx],
      this.gameState.players[bidderIdx],
      auction.goatOnOffer,
      bidEntry.bid
    );

    this.gameState.players[auctioneerIdx] = updatedAuctioneer;
    this.gameState.players[bidderIdx] = updatedBidder;

    this.clearAuctionTimer();
    this.endAuction();
  }
}
