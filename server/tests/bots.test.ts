/**
 * Unit tests for bot strategy logic and BotManager.
 * Uses Jest (same runner as the rest of the server tests).
 */

import {
  NaiveBotStrategy,
  randInt,
  roundUpToStep,
  currentMaxBid,
  highestBidEntry,
} from '../src/bots/NaiveBotStrategy';
import { BotManager } from '../src/bots/BotManager';
import { AuctionState, BidEntry, GoatType, PlayerState, ValueSheet } from 'shared/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'player-1',
    name: 'Test Bot',
    hand: [],
    cash: 100,
    isBot: true,
    ...overrides,
  };
}

function makeValueSheet(overrides: Partial<ValueSheet> = {}): ValueSheet {
  return {
    [GoatType.Silly]: 10,
    [GoatType.Angry]: 7,
    [GoatType.Happy]: 4,
    [GoatType.Hungry]: 1,
    ...overrides,
  };
}

function makeAuction(overrides: Partial<AuctionState> = {}): AuctionState {
  return {
    auctioneerPlayerId: 'auctioneer',
    goatOnOffer: { id: 'g1', type: GoatType.Silly },
    bids: [],
    heldBid: null,
    status: 'open',
    timerEndsAt: Date.now() + 30_000,
    ...overrides,
  };
}

function makeBidEntry(bidderId: string, cash: number): BidEntry {
  return {
    bidderId,
    bid: { cash, goats: [] },
    bidPlacedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// randInt
// ---------------------------------------------------------------------------

describe('randInt', () => {
  it('returns a value within [min, max]', () => {
    for (let i = 0; i < 200; i++) {
      const v = randInt(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('returns an integer', () => {
    for (let i = 0; i < 50; i++) {
      expect(Number.isInteger(randInt(0, 100))).toBe(true);
    }
  });

  it('returns min when min === max', () => {
    expect(randInt(7, 7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// roundUpToStep
// ---------------------------------------------------------------------------

describe('roundUpToStep', () => {
  it('rounds up to the next multiple when not already aligned', () => {
    expect(roundUpToStep(11, 5)).toBe(15);
    expect(roundUpToStep(16, 5)).toBe(20);
    expect(roundUpToStep(21, 5)).toBe(25);
  });

  it('returns the value unchanged when already aligned', () => {
    expect(roundUpToStep(15, 5)).toBe(15);
    expect(roundUpToStep(20, 5)).toBe(20);
  });

  it('handles zero correctly', () => {
    expect(roundUpToStep(0, 5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// currentMaxBid
// ---------------------------------------------------------------------------

describe('currentMaxBid', () => {
  it('returns 0 when there are no bids', () => {
    expect(currentMaxBid(makeAuction())).toBe(0);
  });

  it('returns the highest open bid', () => {
    const auction = makeAuction({
      bids: [makeBidEntry('a', 10), makeBidEntry('b', 20)],
    });
    expect(currentMaxBid(auction)).toBe(20);
  });

  it('includes the held bid in the max calculation', () => {
    const auction = makeAuction({
      bids: [makeBidEntry('a', 10)],
      heldBid: makeBidEntry('b', 30),
    });
    expect(currentMaxBid(auction)).toBe(30);
  });

  it('returns held bid value when there are no open bids', () => {
    const auction = makeAuction({ heldBid: makeBidEntry('b', 25) });
    expect(currentMaxBid(auction)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// highestBidEntry
// ---------------------------------------------------------------------------

describe('highestBidEntry', () => {
  it('returns undefined when no bids exist', () => {
    expect(highestBidEntry(makeAuction())).toBeUndefined();
  });

  it('returns the highest open bid entry', () => {
    const auction = makeAuction({
      bids: [makeBidEntry('a', 5), makeBidEntry('b', 15)],
    });
    expect(highestBidEntry(auction)?.bidderId).toBe('b');
  });

  it('considers held bid in the comparison', () => {
    const auction = makeAuction({
      bids: [makeBidEntry('a', 5)],
      heldBid: makeBidEntry('b', 20),
    });
    expect(highestBidEntry(auction)?.bidderId).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// NaiveBotStrategy — decideAuction
// ---------------------------------------------------------------------------

describe('NaiveBotStrategy.decideAuction', () => {
  const strategy = new NaiveBotStrategy();

  it('picks the lowest-value goat', () => {
    const player = makePlayer({
      hand: [
        { id: 'silly', type: GoatType.Silly },
        { id: 'hungry', type: GoatType.Hungry },
        { id: 'angry', type: GoatType.Angry },
      ],
    });
    const sheet = makeValueSheet(); // Silly=10, Angry=7, Happy=4, Hungry=1
    // Hungry (value 1) is lowest
    const decision = strategy.decideAuction(player, sheet);
    expect(decision.goatId).toBe('hungry');
  });

  it('returns a positive delay', () => {
    const player = makePlayer({ hand: [{ id: 'g1', type: GoatType.Happy }] });
    const decision = strategy.decideAuction(player, makeValueSheet());
    expect(decision.delayMs).toBeGreaterThan(0);
  });

  it('returns a goat id that exists in the hand', () => {
    const player = makePlayer({
      hand: [
        { id: 'a', type: GoatType.Happy },
        { id: 'b', type: GoatType.Angry },
      ],
    });
    const decision = strategy.decideAuction(player, makeValueSheet());
    const ids = player.hand.map((g) => g.id);
    expect(ids).toContain(decision.goatId);
  });

  it('works with a single goat in hand', () => {
    const player = makePlayer({ hand: [{ id: 'solo', type: GoatType.Silly }] });
    const decision = strategy.decideAuction(player, makeValueSheet());
    expect(decision.goatId).toBe('solo');
  });
});

// ---------------------------------------------------------------------------
// NaiveBotStrategy — decideBid
// ---------------------------------------------------------------------------

describe('NaiveBotStrategy.decideBid', () => {
  const strategy = new NaiveBotStrategy();

  // Goat on offer: Silly, worth 10 to the bot
  const sillyAuction = makeAuction({
    goatOnOffer: { id: 'g1', type: GoatType.Silly },
  });
  const sheet = makeValueSheet(); // Silly = 10

  it('bids when there are no existing bids and the goat is valuable', () => {
    const player = makePlayer({ cash: 100 });
    // With no bids, maxExisting = 0; maxWillingToPay = 10 - buffer(3-8) >= 2
    // There is always room to bid
    const decision = strategy.decideBid(player, sheet, sillyAuction, [player]);
    expect(decision.action).toBe('bid');
    expect(decision.bid?.cash).toBeGreaterThan(0);
  });

  it('passes when current max bid already exceeds the bots willingness to pay', () => {
    // Silly = 10, profitBuffer at minimum is 3 → maxWillingToPay ≤ 7
    // Set existing bid very high to make pass deterministic
    const veryHighAuction = makeAuction({
      bids: [makeBidEntry('someone', 50)],
    });
    const player = makePlayer({ cash: 100 });
    const decision = strategy.decideBid(player, sheet, veryHighAuction, [player]);
    expect(decision.action).toBe('pass');
  });

  it('passes when the bot already has the highest open bid', () => {
    const player = makePlayer({ id: 'bot-1', cash: 100 });
    const auction = makeAuction({
      bids: [makeBidEntry('bot-1', 5)],
    });
    const decision = strategy.decideBid(player, sheet, auction, [player]);
    expect(decision.action).toBe('pass');
  });

  it('passes when the bot already has the highest held bid', () => {
    const player = makePlayer({ id: 'bot-1', cash: 100 });
    const auction = makeAuction({
      heldBid: makeBidEntry('bot-1', 5),
    });
    const decision = strategy.decideBid(player, sheet, auction, [player]);
    expect(decision.action).toBe('pass');
  });

  it('passes when the bot cannot afford to bid higher', () => {
    const broke = makePlayer({ cash: 0 });
    const decision = strategy.decideBid(broke, sheet, sillyAuction, [broke]);
    expect(decision.action).toBe('pass');
  });

  it('bids in multiples of 5 (chunked, not +1)', () => {
    // Use a very high-value goat so the profit-buffer cap never clips the bid to a
    // non-multiple.  With value=1000, maxWillingToPay = 992-997, far above any
    // realistic bid, so the only cap that applies is the round-up-to-5 step.
    const richSheet = makeValueSheet({ [GoatType.Silly]: 1000 });
    const player = makePlayer({ cash: 1000 });
    const results: number[] = [];
    for (let i = 0; i < 50; i++) {
      const d = strategy.decideBid(player, richSheet, sillyAuction, [player]);
      if (d.action === 'bid' && d.bid) results.push(d.bid.cash);
    }
    // All bids must be multiples of 5 (the rounding step)
    for (const cash of results) {
      expect(cash % 5).toBe(0);
    }
    // Sanity: we should have gotten some bids in 50 tries
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns a positive delay when it bids', () => {
    const player = makePlayer({ cash: 100 });
    let foundBid = false;
    for (let i = 0; i < 20; i++) {
      const d = strategy.decideBid(player, sheet, sillyAuction, [player]);
      if (d.action === 'bid') {
        expect(d.delayMs).toBeGreaterThan(0);
        foundBid = true;
        break;
      }
    }
    expect(foundBid).toBe(true);
  });

  it('does not bid more than the player has in cash', () => {
    const poorBot = makePlayer({ cash: 6 });
    for (let i = 0; i < 30; i++) {
      const d = strategy.decideBid(poorBot, sheet, sillyAuction, [poorBot]);
      if (d.action === 'bid') {
        expect(d.bid!.cash).toBeLessThanOrEqual(6);
      }
    }
  });

  it('passes when the goat is worthless to the bot (value = 0)', () => {
    const zeroSheet = makeValueSheet({ [GoatType.Silly]: 0 });
    const player = makePlayer({ cash: 100 });
    const decision = strategy.decideBid(player, zeroSheet, sillyAuction, [player]);
    expect(decision.action).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// NaiveBotStrategy — decideAccept
// ---------------------------------------------------------------------------

describe('NaiveBotStrategy.decideAccept', () => {
  const strategy = new NaiveBotStrategy(0.7); // 70% threshold
  const auctioneer = makePlayer({ id: 'auctioneer' });
  const sheet = makeValueSheet(); // Silly = 10 → min acceptable = floor(10 * 0.7) = 7

  it('accepts when a bid meets the threshold', () => {
    const auction = makeAuction({ bids: [makeBidEntry('bidder', 7)] });
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.action).toBe('accept');
    expect(decision.bidderId).toBe('bidder');
  });

  it('waits when no bid meets the threshold', () => {
    const auction = makeAuction({ bids: [makeBidEntry('bidder', 5)] });
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.action).toBe('wait');
  });

  it('waits when there are no bids at all', () => {
    const auction = makeAuction();
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.action).toBe('wait');
  });

  it('prefers the highest acceptable bid when multiple exist', () => {
    const auction = makeAuction({
      bids: [makeBidEntry('low', 7), makeBidEntry('high', 9)],
    });
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.bidderId).toBe('high');
  });

  it('considers the held bid alongside open bids', () => {
    const auction = makeAuction({
      bids: [makeBidEntry('open', 7)],
      heldBid: makeBidEntry('held', 9),
    });
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.bidderId).toBe('held');
  });

  it('accepts the held bid when it is the only acceptable offer', () => {
    const auction = makeAuction({ heldBid: makeBidEntry('held', 8) });
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.action).toBe('accept');
    expect(decision.bidderId).toBe('held');
  });

  it('returns a positive delay when accepting', () => {
    const auction = makeAuction({ bids: [makeBidEntry('bidder', 10)] });
    const decision = strategy.decideAccept(auctioneer, sheet, auction);
    expect(decision.action).toBe('accept');
    expect(decision.delayMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// BotManager
// ---------------------------------------------------------------------------

describe('BotManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls the action after the given delay', () => {
    const mgr = new BotManager();
    const fn = jest.fn();
    mgr.schedule('k1', 500, fn);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels the previous timer when rescheduling the same key', () => {
    const mgr = new BotManager();
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    mgr.schedule('k1', 300, fn1);
    mgr.schedule('k1', 600, fn2); // replaces k1
    jest.advanceTimersByTime(300);
    expect(fn1).not.toHaveBeenCalled(); // cancelled
    jest.advanceTimersByTime(300);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('cancel() prevents the action from firing', () => {
    const mgr = new BotManager();
    const fn = jest.fn();
    mgr.schedule('k1', 200, fn);
    mgr.cancel('k1');
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() is a no-op for unknown keys', () => {
    const mgr = new BotManager();
    expect(() => mgr.cancel('does-not-exist')).not.toThrow();
  });

  it('cancelAll() stops all pending timers', () => {
    const mgr = new BotManager();
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    mgr.schedule('a', 100, fn1);
    mgr.schedule('b', 200, fn2);
    expect(mgr.pendingCount).toBe(2);
    mgr.cancelAll();
    expect(mgr.pendingCount).toBe(0);
    jest.advanceTimersByTime(300);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('pendingCount decreases after a timer fires', () => {
    const mgr = new BotManager();
    mgr.schedule('a', 100, () => {});
    expect(mgr.pendingCount).toBe(1);
    jest.advanceTimersByTime(100);
    expect(mgr.pendingCount).toBe(0);
  });

  it('schedules multiple independent timers under different keys', () => {
    const mgr = new BotManager();
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    mgr.schedule('a', 100, fn1);
    mgr.schedule('b', 200, fn2);
    jest.advanceTimersByTime(100);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
