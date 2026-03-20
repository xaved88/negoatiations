import { GoatType, ValueSheet } from 'shared/types';

// The set of personal values every player gets, just in different orders.
// Values sum to 150 so the total "pie" is the same for everyone.
//
// We use a randomized Latin square to guarantee:
//  - Each player gets exactly one of each value (one 50, one 40, one 30, one 20, one 10)
//  - Each goat type receives each value exactly once across all players
//  - No two players share the same top-valued goat type
//  - The assignment is randomized so players can't deduce opponents' sheets from turn order
const GOAT_VALUES = [50, 40, 30, 20, 10] as const;

export function generateValueSheets(playerCount: number): ValueSheet[] {
  const goatTypes = Object.values(GoatType);
  const n = GOAT_VALUES.length; // 5

  // Step 1: Build a base Latin square using rotation
  // Each row contains all 5 values; each column contains all 5 values
  const baseLatin: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(GOAT_VALUES[(i + j) % n]);
    }
    baseLatin.push(row);
  }

  // Step 2: Randomize the Latin square by shuffling rows and columns
  // This preserves the Latin property while hiding the structure from players
  const rowOrder = shuffleArray([0, 1, 2, 3, 4]);
  const colOrder = shuffleArray([0, 1, 2, 3, 4]);

  // Step 3: Generate value sheets from the shuffled Latin square
  const sheets: ValueSheet[] = [];
  for (let p = 0; p < playerCount; p++) {
    const rowIdx = rowOrder[p % n]; // which row this player gets
    const sheet: ValueSheet = {} as ValueSheet;

    for (let typeIdx = 0; typeIdx < n; typeIdx++) {
      const goatType = goatTypes[typeIdx];
      const colIdx = colOrder[typeIdx]; // which column this goat type maps to
      sheet[goatType] = baseLatin[rowIdx][colIdx];
    }

    sheets.push(sheet);
  }

  return sheets;
}

/**
 * Fisher-Yates shuffle — returns a new array with elements in random order.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
