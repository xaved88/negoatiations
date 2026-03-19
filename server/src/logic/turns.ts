import { TURNS_PER_GAME } from 'shared/constants';

export function nextAuctioneerIndex(
  current: number,
  playerCount: number
): number {
  return (current + 1) % playerCount;
}

export function isGameOver(turnNumber: number): boolean {
  return turnNumber >= TURNS_PER_GAME;
}
