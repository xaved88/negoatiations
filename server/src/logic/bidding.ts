import { Bid, BidEntry, PlayerState, Goat } from 'shared/types';

export function validateBid(bid: Bid, bidderState: PlayerState): boolean {
  // Cash must be non-negative
  if (bid.cash < 0) {
    return false;
  }

  // Check bidder has enough cash
  if (bid.cash > bidderState.cash) {
    return false;
  }

  // Check for duplicate goat IDs in the bid
  const bidGoatIds = bid.goats.map((g) => g.id);
  if (new Set(bidGoatIds).size !== bidGoatIds.length) {
    return false;
  }

  // Check bidder actually has every goat they're offering
  const handIds = new Set(bidderState.hand.map((g) => g.id));
  for (const goat of bid.goats) {
    if (!handIds.has(goat.id)) {
      return false;
    }
  }

  return true;
}

export function applyAcceptedBid(
  auctioneer: PlayerState,
  bidder: PlayerState,
  goatOnOffer: Goat,
  bid: Bid
): [PlayerState, PlayerState] {
  const bidGoatIds = new Set(bid.goats.map((g) => g.id));

  // Auctioneer: remove goat on offer, gain bid cash, gain bid goats
  const updatedAuctioneer: PlayerState = {
    ...auctioneer,
    hand: [
      ...auctioneer.hand.filter((g) => g.id !== goatOnOffer.id),
      ...bid.goats,
    ],
    cash: auctioneer.cash + bid.cash,
  };

  // Bidder: remove bid goats, gain goat on offer, lose bid cash
  const updatedBidder: PlayerState = {
    ...bidder,
    hand: [
      ...bidder.hand.filter((g) => !bidGoatIds.has(g.id)),
      goatOnOffer,
    ],
    cash: bidder.cash - bid.cash,
  };

  return [updatedAuctioneer, updatedBidder];
}

export function applyRejectedBid(
  bids: BidEntry[],
  bidderId: string
): BidEntry[] {
  return bids.filter((b) => b.bidderId !== bidderId);
}
