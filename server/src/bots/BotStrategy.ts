import { AuctionState, Bid, PlayerState, ValueSheet } from 'shared/types';

/** What a bot does when it's their turn to auction a goat */
export interface AuctioneerAction {
  goatId: string;
  /** Milliseconds to wait before putting the goat up */
  delayMs: number;
}

/** What a bot does when deciding whether/how to bid */
export interface BidAction {
  action: 'bid' | 'pass';
  bid?: Bid;
  /** Milliseconds to wait before submitting the bid (only meaningful when action === 'bid') */
  delayMs: number;
}

/** What a bot does when it's the auctioneer and evaluating incoming bids */
export interface AcceptAction {
  action: 'accept' | 'hold' | 'reject' | 'wait';
  /** The bidderId to act on — required when action is 'accept', 'hold', or 'reject' */
  bidderId?: string;
  /** Milliseconds to wait before executing the action */
  delayMs: number;
}

/**
 * A BotStrategy encapsulates one bot's decision-making logic.
 *
 * All methods are pure-ish: they may call Math.random() for variety but
 * must not mutate game state or schedule any timers themselves.
 * The GameRoom is responsible for applying decisions and managing timing.
 *
 * This interface is intentionally designed so that different strategy
 * implementations (naive, conservative, risky, random, etc.) can be swapped
 * in without touching the GameRoom wiring code.
 */
export interface BotStrategy {
  /**
   * Decide which goat to put up for auction and when.
   * Called when it's the bot's turn as auctioneer and no auction is active.
   * The bot is guaranteed to have at least one goat in hand when this is called.
   */
  decideAuction(player: PlayerState, valueSheet: ValueSheet): AuctioneerAction;

  /**
   * Decide whether to place a bid, and if so how much, and when.
   * Called each time the bot should reconsider its bidding position.
   * The bot is guaranteed to NOT be the auctioneer when this is called.
   */
  decideBid(
    player: PlayerState,
    valueSheet: ValueSheet,
    auction: AuctionState,
    allPlayers: PlayerState[],
  ): BidAction;

  /**
   * Decide whether to accept a bid when the bot is the auctioneer.
   * Called each time bids change and the bot needs to re-evaluate.
   * Returns 'wait' if no current bid is worth accepting yet.
   */
  decideAccept(
    auctioneer: PlayerState,
    valueSheet: ValueSheet,
    auction: AuctionState,
  ): AcceptAction;
}
