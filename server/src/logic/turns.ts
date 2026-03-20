import { TURNS_PER_GAME } from 'shared/constants';

export function nextAuctioneerIndex(
  current: number,
  playerCount: number
): number {
  return (current + 1) % playerCount;
}

export function isGameOver(turnNumber: number, playerCount: number): boolean {
  return Math.floor(turnNumber / playerCount) >= TURNS_PER_GAME;
}
