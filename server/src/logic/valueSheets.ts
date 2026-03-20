import { GoatType, ValueSheet } from 'shared/types';

// The set of personal values every player gets, just rotated differently.
// Values sum to 150 so the total "pie" is the same for everyone.
//
// Unique rotation per player index guarantees:
//  - Each player's #1 goat type is different from every other player's #1 type.
//  - Latin-square property: across all 5 players, each type receives
//    each value exactly once (no two players compete for the same "top goat").
const GOAT_VALUES = [50, 40, 30, 20, 10] as const;

export function generateValueSheets(playerCount: number): ValueSheet[] {
  const goatTypes = Object.values(GoatType); // order matches GoatType enum: Silly, Angry, Happy, Hungry, Grumpy
  const n = GOAT_VALUES.length; // 5
  const sheets: ValueSheet[] = [];

  for (let i = 0; i < playerCount; i++) {
    const sheet: ValueSheet = {} as ValueSheet;
    goatTypes.forEach((type, typeIdx) => {
      // Rotate the values array left by i positions so each player has a
      // different goat at rank 1 (and at every other rank).
      sheet[type] = GOAT_VALUES[(typeIdx + i) % n];
    });
    sheets.push(sheet);
  }

  return sheets;
}
