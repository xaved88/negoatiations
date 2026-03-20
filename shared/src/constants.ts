export const MAX_PLAYERS = 5;
export const STARTING_CASH = 100;
export const GOATS_PER_PLAYER = 5;
export const GOAT_TYPES = 5;
export const TURNS_PER_GAME = process.env.TEST_MODE === 'true' ? 4 : 3;
export const AUCTION_TIMER_SECONDS = process.env.TEST_MODE === 'true' ? 5 : 30;
export const BID_LOCK_SECONDS = process.env.TEST_MODE === 'true' ? 2 : 5;
export const SERVER_PORT = 2567;
export const CLIENT_PORT = 5173;
