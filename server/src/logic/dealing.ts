import { Goat, GoatType } from 'shared/types';

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function dealHands(
  playerCount: number,
  goatsPerPlayer: number
): Goat[][] {
  const goatTypes = Object.values(GoatType);
  const totalGoats = playerCount * goatsPerPlayer;
  const goats: Goat[] = [];

  // Distribute goat types evenly using modulo
  for (let i = 0; i < totalGoats; i++) {
    const type = goatTypes[i % goatTypes.length];
    goats.push({
      id: `goat-${i}`,
      type,
    });
  }

  // Shuffle the pool
  const shuffled = shuffleArray(goats);

  // Deal into hands
  const hands: Goat[][] = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(shuffled.slice(i * goatsPerPlayer, (i + 1) * goatsPerPlayer));
  }

  return hands;
}
