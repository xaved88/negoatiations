import { Room, Client } from 'colyseus';
import {
  GameState,
  PlayerState,
  ValueSheet,
  Bid,
  BidEntry,
  AuctionState,
} from 'shared/types';
import { STARTING_CASH, GOATS_PER_PLAYER, AUCTION_TIMER_SECONDS, BID_LOCK_SECONDS } from 'shared/constants';
import { dealHands } from '../logic/dealing';
import { generateValueSheets } from '../logic/valueSheets';
import { validateBid, applyAcceptedBid, applyRejectedBid } from '../logic/bidding';
import { nextAuctioneerIndex, isGameOver } from '../logic/turns';
import { computeScores } from '../logic/scoring';

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

  private handleStartGame(client: Client) {
    if (this.gameState.phase !== 'lobby') return;
    if (this.gameState.players.length < 2) return;
    // Only the host (first player to join) may start the game
    if (client.sessionId !== this.hostClientId) return;

    const hands = dealHands(this.gameState.players.length, GOATS_PER_PLAYER);
    for (let i = 0; i < this.gameState.players.length; i++) {
      this.gameState.players[i].hand = hands[i];
    }

    const sheets = generateValueSheets(this.gameState.players.length);
    for (let i = 0; i < this.gameState.players.length; i++) {
      this.playerValueSheets[this.gameState.players[i].id] = sheets[i];
    }

    this.gameState.phase = 'playing';
    this.gameState.currentAuctioneerIndex = 0;
    this.gameState.turnNumber = 0;

    // Send value sheets privately — each client only sees their own
    for (const clientSession of this.clients) {
      const playerId = this.clientIdToPlayerId[clientSession.sessionId];
      const sheet = this.playerValueSheets[playerId];
      if (sheet) {
        clientSession.send('yourValueSheet', sheet);
      }
    }

    this.broadcastState();
  }

  private handlePutUpForAuction(client: Client, data: { goatId: string }) {
    if (this.gameState.phase !== 'playing' || this.gameState.auction !== null) return;

    const playerId = this.clientIdToPlayerId[client.sessionId];
    if (!playerId) return;

    const playerIdx = this.gameState.players.findIndex((p) => p.id === playerId);
    if (playerIdx !== this.gameState.currentAuctioneerIndex) return;

    const player = this.gameState.players[playerIdx];
    const goat = player.hand.find((g) => g.id === data.goatId);
    if (!goat) return;

    const timerEndsAt = Date.now() + AUCTION_TIMER_SECONDS * 1000;

    const auction: AuctionState = {
      auctioneerPlayerId: playerId,
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

    // Replace only the player's existing *open* bid (in bids[]).
    // The held-bid slot (auction.heldBid) is completely separate — if this
    // player's bid is currently held, they still get a fresh open-bid slot.
    this.gameState.auction.bids = this.gameState.auction.bids.filter(
      (b) => b.bidderId !== playerId
    );

    const bidEntry: BidEntry = { bidderId: playerId, bid, bidPlacedAt: Date.now() };
    this.gameState.auction.bids.push(bidEntry);
    this.broadcastState();
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
  }

  private handleAuctionTimeout() {
    if (!this.gameState.auction || this.gameState.phase !== 'playing') return;

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

  // Clears auction state, advances the turn, checks for game over, and broadcasts.
  // Call this after the exchange (if any) has already been applied to player states.
  private endAuction() {
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
  }

  private broadcastState() {
    this.broadcast('stateUpdate', this.gameState);
  }
}
