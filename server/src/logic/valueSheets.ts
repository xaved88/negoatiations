import { GoatType, ValueSheet } from 'shared/types';

export function generateValueSheets(playerCount: number): ValueSheet[] {
  const goatTypes = Object.values(GoatType);
  const sheets: ValueSheet[] = [];

  // Permutations chosen so the first 4 each have a unique value at every position.
  // This guarantees that when playerCount <= 4, all players value every goat type differently.
  // Additional permutations cycle through for larger player counts.
  const permutations = [
    [1, 2, 3, 4],
    [2, 3, 4, 1],
    [3, 4, 1, 2],
    [4, 1, 2, 3],
    [1, 3, 4, 2],
    [2, 4, 1, 3],
    [3, 1, 2, 4],
    [4, 2, 3, 1],
    [1, 4, 2, 3],
    [2, 1, 3, 4],
    [3, 2, 4, 1],
    [4, 3, 1, 2],
    [1, 2, 4, 3],
    [2, 3, 1, 4],
    [3, 4, 2, 1],
    [4, 1, 3, 2],
    [2, 1, 4, 3],
    [3, 2, 1, 4],
    [4, 3, 2, 1],
    [1, 4, 3, 2],
    [2, 4, 3, 1],
    [3, 1, 4, 2],
    [4, 2, 1, 3],
    [1, 3, 2, 4],
  ];

  for (let i = 0; i < playerCount; i++) {
    const perm = permutations[i % permutations.length];
    const sheet: ValueSheet = {} as ValueSheet;
    goatTypes.forEach((type, idx) => {
      sheet[type] = perm[idx];
    });
    sheets.push(sheet);
  }

  return sheets;
}
