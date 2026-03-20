import { AuctionState, Bid, PlayerState, ValueSheet } from 'shared/types';
import { AcceptAction, AuctioneerAction, BidAction, BotStrategy } from './BotStrategy';

// ---------------------------------------------------------------------------
// Internal helpers (pure, no side effects)
// ---------------------------------------------------------------------------

/** Returns a random integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Round `value` UP to the nearest multiple of `step`.
 * Used so bids land on nice numbers (15, 20, 25 …) rather than 11, 13, 17.
 */
export function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * Return the highest cash bid currently in the auction across open bids
 * and the held bid slot.
 */
export function currentMaxBid(auction: AuctionState): number {
  const open = auction.bids.map((b) => b.bid.cash);
  const held = auction.heldBid ? [auction.heldBid.bid.cash] : [];
  const all = [...open, ...held];
  return all.length > 0 ? Math.max(...all) : 0;
}

/**
 * Find the bid entry with the highest cash value across open + held bids.
 * Returns undefined if there are no bids at all.
 */
export function highestBidEntry(
  auction: AuctionState,
): { bidderId: string; cash: number } | undefined {
  const candidates = [
    ...auction.bids.map((b) => ({ bidderId: b.bidderId, cash: b.bid.cash })),
    ...(auction.heldBid
      ? [{ bidderId: auction.heldBid.bidderId, cash: auction.heldBid.bid.cash }]
      : []),
  ];
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, c) => (c.cash >= best.cash ? c : best));
}

// ---------------------------------------------------------------------------
// NaiveBotStrategy
// ---------------------------------------------------------------------------

/**
 * A "naive" bot strategy: bids on any goat where it can turn a profit, and
 * accepts bids that cover a minimum fraction of the goat's personal value.
 *
 * **Auctioneering:**
 *   - Sells the goat with the lowest personal value (least regret).
 *   - Waits a random 1–3 s before putting it up.
 *   - Accepts any bid ≥ `sellThreshold × goatValue` with a random 2–5 s delay.
 *
 * **Bidding:**
 *   - Will only bid if `goatValue > currentMaxBid` (room to profit).
 *   - Will not bid if it already holds the highest offer.
 *   - Bids in chunked increments of 5–15 gold (rounded up to nearest 5)
 *     so it looks human-like rather than always adding exactly 1.
 *   - Caps its maximum bid at `goatValue − profitBuffer` (random 3–8 gold)
 *     to preserve a profit margin.
 *   - Waits a random 1.5–5 s before submitting.
 *
 * **Timing notes (to keep gameplay fun):**
 *   - Delays are randomised so multiple bots don't all fire at once.
 *   - Bids never land right at the bot's ceiling (profit buffer prevents this).
 *   - The chunked increment means bidding wars feel more natural.
 */
export class NaiveBotStrategy implements BotStrategy {
  /**
   * Minimum fraction of the goat's personal value the bot will accept as cash
   * when it's the auctioneer. Default 0.7 means "take 7 gold for a 10-point goat".
   */
  private readonly sellThreshold: number;

  constructor(sellThreshold = 0.7) {
    this.sellThreshold = sellThreshold;
  }

  // -------------------------------------------------------------------------
  // BotStrategy implementation
  // -------------------------------------------------------------------------

  decideAuction(player: PlayerState, valueSheet: ValueSheet): AuctioneerAction {
    // Sell the goat we value least — least regret, most rational
    const sorted = [...player.hand].sort(
      (a, b) => valueSheet[a.type] - valueSheet[b.type],
    );
    return {
      goatId: sorted[0].id,
      delayMs: randInt(1_000, 3_000),
    };
  }

  decideBid(
    player: PlayerState,
    valueSheet: ValueSheet,
    auction: AuctionState,
    _allPlayers: PlayerState[],
  ): BidAction {
    const pass: BidAction = { action: 'pass', delayMs: 0 };

    const goatValue = valueSheet[auction.goatOnOffer.type];
    const maxExisting = currentMaxBid(auction);

    // Already holding the top bid? Wait and see — don't outbid ourselves.
    const allBids = [
      ...auction.bids,
      ...(auction.heldBid ? [auction.heldBid] : []),
    ];
    const ourBid = allBids.find((b) => b.bidderId === player.id);
    if (ourBid && ourBid.bid.cash >= maxExisting) {
      return pass;
    }

    // Calculate our maximum willingness to pay (must leave a profit margin)
    const profitBuffer = randInt(3, 8);
    const maxWillingToPay = goatValue - profitBuffer;

    // No room to profit at current prices
    if (maxWillingToPay <= maxExisting) {
      return pass;
    }

    // Build the next bid in a chunked increment, rounded to a nice multiple of 5.
    // This avoids the boring "+1 forever" pattern.
    const increment = randInt(5, 15);
    const roundedBid = roundUpToStep(maxExisting + increment, 5);

    // Cap at our max willingness to pay
    const finalBid = Math.min(roundedBid, maxWillingToPay);

    // Can't afford it
    if (finalBid > player.cash) {
      return pass;
    }

    // Must actually beat the current top
    if (finalBid <= maxExisting) {
      return pass;
    }

    const bid: Bid = { cash: finalBid, goats: [] };
    return {
      action: 'bid',
      bid,
      delayMs: randInt(1_500, 5_000),
    };
  }

  decideAccept(
    _auctioneer: PlayerState,
    valueSheet: ValueSheet,
    auction: AuctionState,
  ): AcceptAction {
    const goatValue = valueSheet[auction.goatOnOffer.type];
    const minAcceptable = Math.floor(goatValue * this.sellThreshold);

    // Gather every bid (open + held) that meets our threshold
    const candidates = [
      ...(auction.heldBid ? [auction.heldBid] : []),
      ...auction.bids,
    ].filter((b) => b.bid.cash >= minAcceptable);

    if (candidates.length === 0) {
      return { action: 'wait', delayMs: 0 };
    }

    // Accept the highest offer among acceptable ones
    const best = candidates.reduce((a, b) => (a.bid.cash >= b.bid.cash ? a : b));

    return {
      action: 'accept',
      bidderId: best.bidderId,
      delayMs: randInt(2_000, 5_000),
    };
  }
}
