import { Goat, GoatType } from 'shared/types';

export function dealHands(
  playerCount: number,
  goatsPerPlayer: number
): Goat[][] {
  const goatTypes = Object.values(GoatType);
  const hands: Goat[][] = [];

  for (let playerIdx = 0; playerIdx < playerCount; playerIdx++) {
    const hand: Goat[] = goatTypes.map((type, typeIdx) => ({
      id: `goat-p${playerIdx}-${typeIdx}`,
      type,
    }));
    hands.push(hand);
  }

  return hands;
}
