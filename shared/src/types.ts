export enum GoatType {
  Silly = 'Silly',
  Angry = 'Angry',
  Happy = 'Happy',
  Hungry = 'Hungry',
}

export interface Goat {
  id: string;
  type: GoatType;
}

export type ValueSheet = Record<GoatType, number>;

export interface Bid {
  cash: number;
  goats: Goat[];
}

export interface BidEntry {
  bidderId: string;
  bid: Bid;
  bidPlacedAt?: number; // Unix timestamp (ms) when the bid was placed; used for the retraction lock window
}

export interface AuctionState {
  auctioneerPlayerId: string;
  goatOnOffer: Goat;
  bids: BidEntry[];
  status: 'open' | 'closed';
  heldBidderId: string | null;     // which bid is currently marked as held
  timerEndsAt: number | null;      // Unix timestamp (ms) when auction auto-closes
}

export interface PlayerState {
  id: string;
  name: string;
  hand: Goat[];
  cash: number;
  isBot: boolean;
}

export type GamePhase = 'lobby' | 'playing' | 'ended';

export interface GameState {
  players: PlayerState[];
  phase: GamePhase;
  currentAuctioneerIndex: number;
  auction: AuctionState | null;
  turnNumber: number;
  scores: Record<string, number> | null;
}

// Client → Server messages
export interface PutUpForAuctionMsg {
  type: 'PutUpForAuction';
  goatId: string;
}

export interface PlaceBidMsg {
  type: 'PlaceBid';
  bid: Bid;
}

export interface AcceptBidMsg {
  type: 'AcceptBid';
  bidderId: string;
}

export interface HoldBidMsg {
  type: 'HoldBid';
  bidderId: string;
}

export interface RejectBidMsg {
  type: 'RejectBid';
  bidderId: string;
}

export interface RetractBidMsg {
  type: 'RetractBid';
}

export interface StartGameMsg {
  type: 'StartGame';
}

// Server → Client events
export interface GameOverEvent {
  scores: Record<string, number>;
  valueSheets: Record<string, ValueSheet>;
}
