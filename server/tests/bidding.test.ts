import { validateBid, applyAcceptedBid, applyRejectedBid } from '../src/logic/bidding';
import { Bid, BidEntry, PlayerState, GoatType } from 'shared/types';

// ─── Shared fixtures ───────────────────────────────────────────────────────────

const sillyGoat = { id: 'goat-1', type: GoatType.Silly };
const happyGoat = { id: 'goat-2', type: GoatType.Happy };
const angryGoat = { id: 'goat-3', type: GoatType.Angry };

const bidder: PlayerState = {
  id: 'player-1',
  name: 'Alice',
  hand: [sillyGoat, happyGoat],
  cash: 100,
  isBot: false,
};

const auctioneer: PlayerState = {
  id: 'player-2',
  name: 'Bob',
  hand: [angryGoat, { id: 'goat-4', type: GoatType.Happy }],
  cash: 50,
  isBot: false,
};

// ─── validateBid ───────────────────────────────────────────────────────────────

describe('validateBid', () => {
  it('returns true for a valid cash-only bid', () => {
    const bid: Bid = { cash: 50, goats: [] };
    expect(validateBid(bid, bidder)).toBe(true);
  });

  it('returns false when cash exceeds balance', () => {
    const bid: Bid = { cash: 150, goats: [] };
    expect(validateBid(bid, bidder)).toBe(false);
  });

  it('returns true for an exact cash match', () => {
    const bid: Bid = { cash: 100, goats: [] };
    expect(validateBid(bid, bidder)).toBe(true);
  });

  it('returns true for a zero cash bid', () => {
    const bid: Bid = { cash: 0, goats: [] };
    expect(validateBid(bid, bidder)).toBe(true);
  });

  it('returns false for a negative cash bid', () => {
    const bid: Bid = { cash: -10, goats: [] };
    expect(validateBid(bid, bidder)).toBe(false);
  });

  it('returns true when bid includes a valid goat from hand', () => {
    const bid: Bid = { cash: 10, goats: [sillyGoat] };
    expect(validateBid(bid, bidder)).toBe(true);
  });

  it('returns true when bid includes multiple valid goats from hand', () => {
    const bid: Bid = { cash: 0, goats: [sillyGoat, happyGoat] };
    expect(validateBid(bid, bidder)).toBe(true);
  });

  it('returns false when bid includes a goat not in the bidder hand', () => {
    const bid: Bid = { cash: 10, goats: [angryGoat] }; // angryGoat not in bidder.hand
    expect(validateBid(bid, bidder)).toBe(false);
  });

  it('returns false when bid includes duplicate goat IDs', () => {
    const bid: Bid = { cash: 10, goats: [sillyGoat, sillyGoat] };
    expect(validateBid(bid, bidder)).toBe(false);
  });

  it('returns false when bidder has no cash and bid requires cash', () => {
    const brokeBidder: PlayerState = { ...bidder, cash: 0 };
    const bid: Bid = { cash: 1, goats: [] };
    expect(validateBid(bid, brokeBidder)).toBe(false);
  });
});

// ─── applyAcceptedBid ─────────────────────────────────────────────────────────

describe('applyAcceptedBid', () => {
  const goatOnOffer = angryGoat; // auctioneer's goat being sold
  const cashOnlyBid: Bid = { cash: 30, goats: [] };

  it('removes the offered goat from auctioneer hand (cash-only bid)', () => {
    const [updated] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, cashOnlyBid);
    expect(updated.hand.map((g) => g.id)).not.toContain(goatOnOffer.id);
  });

  it('adds cash to auctioneer balance', () => {
    const [updated] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, cashOnlyBid);
    expect(updated.cash).toBe(80); // 50 + 30
  });

  it('adds the offered goat to bidder hand', () => {
    const [, updated] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, cashOnlyBid);
    expect(updated.hand.map((g) => g.id)).toContain(goatOnOffer.id);
  });

  it('subtracts cash from bidder balance', () => {
    const [, updated] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, cashOnlyBid);
    expect(updated.cash).toBe(70); // 100 - 30
  });

  it('preserves other goats already in auctioneer hand', () => {
    const [updated] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, cashOnlyBid);
    expect(updated.hand.map((g) => g.id)).toContain('goat-4');
  });

  it('works with a zero-cash bid — balances unchanged', () => {
    const zeroBid: Bid = { cash: 0, goats: [] };
    const [updatedAuctioneer, updatedBidder] = applyAcceptedBid(
      auctioneer, bidder, goatOnOffer, zeroBid
    );
    expect(updatedAuctioneer.cash).toBe(50);
    expect(updatedBidder.cash).toBe(100);
  });

  it('auctioneer gains bid goats when bid includes goats', () => {
    const bidWithGoat: Bid = { cash: 5, goats: [sillyGoat] };
    const [updatedAuctioneer] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, bidWithGoat);
    expect(updatedAuctioneer.hand.map((g) => g.id)).toContain(sillyGoat.id);
  });

  it('bidder loses bid goats when bid includes goats', () => {
    const bidWithGoat: Bid = { cash: 5, goats: [sillyGoat] };
    const [, updatedBidder] = applyAcceptedBid(auctioneer, bidder, goatOnOffer, bidWithGoat);
    expect(updatedBidder.hand.map((g) => g.id)).not.toContain(sillyGoat.id);
  });

  it('bidder gains offered goat and auctioneer loses it — goat exchange is symmetric', () => {
    const bidWithGoat: Bid = { cash: 0, goats: [sillyGoat, happyGoat] };
    const [updatedAuctioneer, updatedBidder] = applyAcceptedBid(
      auctioneer, bidder, goatOnOffer, bidWithGoat
    );
    // Auctioneer got both bid goats, lost their own goat
    expect(updatedAuctioneer.hand.map((g) => g.id)).toContain(sillyGoat.id);
    expect(updatedAuctioneer.hand.map((g) => g.id)).toContain(happyGoat.id);
    expect(updatedAuctioneer.hand.map((g) => g.id)).not.toContain(goatOnOffer.id);
    // Bidder got offered goat, lost both bid goats
    expect(updatedBidder.hand.map((g) => g.id)).toContain(goatOnOffer.id);
    expect(updatedBidder.hand.map((g) => g.id)).not.toContain(sillyGoat.id);
    expect(updatedBidder.hand.map((g) => g.id)).not.toContain(happyGoat.id);
  });
});

// ─── applyRejectedBid ─────────────────────────────────────────────────────────

describe('applyRejectedBid', () => {
  const bids: BidEntry[] = [
    { bidderId: 'player-1', bid: { cash: 10, goats: [] } },
    { bidderId: 'player-2', bid: { cash: 20, goats: [] } },
    { bidderId: 'player-3', bid: { cash: 30, goats: [] } },
  ];

  it('removes the target bid from the list', () => {
    const result = applyRejectedBid(bids, 'player-2');
    expect(result.map((b) => b.bidderId)).not.toContain('player-2');
    expect(result).toHaveLength(2);
  });

  it('returns unchanged list when bidderId is not found', () => {
    const result = applyRejectedBid(bids, 'player-99');
    expect(result).toHaveLength(3);
  });

  it('returns empty list when the only bid is removed', () => {
    const single: BidEntry[] = [{ bidderId: 'player-1', bid: { cash: 10, goats: [] } }];
    const result = applyRejectedBid(single, 'player-1');
    expect(result).toHaveLength(0);
  });

  it('preserves other bids when removing one from a multi-bid list', () => {
    const result = applyRejectedBid(bids, 'player-1');
    expect(result.map((b) => b.bidderId)).toContain('player-2');
    expect(result.map((b) => b.bidderId)).toContain('player-3');
  });

  it('does not mutate the original bids array', () => {
    const original = [...bids];
    applyRejectedBid(bids, 'player-1');
    expect(bids).toHaveLength(original.length);
  });
});
