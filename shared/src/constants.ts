export const MAX_PLAYERS = 5;
export const STARTING_CASH = 100;
export const GOATS_PER_PLAYER = 5;
export const GOAT_TYPES = 5;
// Number of full rounds per player (each player auctions this many times before game over).
// In a 5-player game, TURNS_PER_GAME=3 means 15 total auctions.
// TEST_MODE uses 1 round per player so tests finish after one full round (playerCount auctions).
export const TURNS_PER_GAME = process.env.TEST_MODE === 'true' ? 1 : 3;
export const AUCTION_TIMER_SECONDS = process.env.TEST_MODE === 'true' ? 5 : 30;
export const BID_LOCK_SECONDS = process.env.TEST_MODE === 'true' ? 2 : 5;
export const SERVER_PORT = 2567;
export const CLIENT_PORT = 5173;
