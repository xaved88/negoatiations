import { generateValueSheets } from '../src/logic/valueSheets';
import { GoatType } from 'shared/types';

describe('generateValueSheets', () => {
  it('should return correct number of sheets', () => {
    const sheets = generateValueSheets(2);
    expect(sheets).toHaveLength(2);
  });

  it('should have all goat types in each sheet', () => {
    const sheets = generateValueSheets(2);
    const types = Object.values(GoatType);

    for (const sheet of sheets) {
      for (const type of types) {
        expect(sheet[type]).toBeDefined();
      }
    }
  });

  it('should use values {10, 20, 30, 40, 50} in each sheet', () => {
    const sheets = generateValueSheets(5);
    const expectedValues = [10, 20, 30, 40, 50];

    for (const sheet of sheets) {
      const values = Object.values(sheet).sort((a, b) => a - b);
      expect(values).toEqual(expectedValues);
    }
  });

  it('should generate different sheets for different players', () => {
    const sheets = generateValueSheets(2);
    const sheet1Values = Object.values(sheets[0]);
    const sheet2Values = Object.values(sheets[1]);

    // At least one value should differ between any two adjacent players
    const allEqual = sheet1Values.every((v, idx) => v === sheet2Values[idx]);
    expect(allEqual).toBe(false);
  });

  it('each player should have a different #1 goat type (unique top value per player)', () => {
    const sheets = generateValueSheets(5);

    // Find each player's top-valued goat type
    const topTypes = sheets.map((sheet) => {
      const entries = Object.entries(sheet) as [GoatType, number][];
      return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
    });

    // All 5 top types must be different
    const unique = new Set(topTypes);
    expect(unique.size).toBe(5);
  });

  it('each goat type receives each value exactly once across 5 players (Latin square)', () => {
    const sheets = generateValueSheets(5);
    const types = Object.values(GoatType);
    const expectedValues = new Set([10, 20, 30, 40, 50]);

    for (const type of types) {
      const valuesForType = new Set(sheets.map((s) => s[type]));
      expect(valuesForType).toEqual(expectedValues);
    }
  });

  it('should work for 2 players with a partial rotation', () => {
    const sheets = generateValueSheets(2);
    const expectedValues = [10, 20, 30, 40, 50];

    for (const sheet of sheets) {
      const values = Object.values(sheet).sort((a, b) => a - b);
      expect(values).toEqual(expectedValues);
    }
  });

  it('should handle more players than goat types by continuing rotation', () => {
    const sheets = generateValueSheets(10);
    expect(sheets).toHaveLength(10);

    const expectedValues = [10, 20, 30, 40, 50];
    for (const sheet of sheets) {
      const values = Object.values(sheet).sort((a, b) => a - b);
      expect(values).toEqual(expectedValues);
    }
  });
});
