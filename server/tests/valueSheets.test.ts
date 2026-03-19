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

  it('should use values 1-4 in each sheet', () => {
    const sheets = generateValueSheets(3);
    const expectedValues = [1, 2, 3, 4];

    for (const sheet of sheets) {
      const values = Object.values(sheet).sort((a, b) => a - b);
      expect(values).toEqual(expectedValues);
    }
  });

  it('should generate different sheets for different players', () => {
    const sheets = generateValueSheets(2);
    const sheet1Values = Object.values(sheets[0]);
    const sheet2Values = Object.values(sheets[1]);

    // At least one value should differ
    const allEqual = sheet1Values.every((v, idx) => v === sheet2Values[idx]);
    expect(allEqual).toBe(false);
  });

  it('should handle more players than permutations by cycling', () => {
    const sheets = generateValueSheets(30);
    expect(sheets).toHaveLength(30);

    // All sheets should still be valid
    const types = Object.values(GoatType);
    for (const sheet of sheets) {
      const values = Object.values(sheet).sort((a, b) => a - b);
      expect(values).toEqual([1, 2, 3, 4]);
    }
  });

  it('should create 4 players with different goat valuations', () => {
    const sheets = generateValueSheets(4);
    const sillyValues = sheets.map((s) => s[GoatType.Silly]);
    const uniqueSillyValues = new Set(sillyValues);

    // All 4 players should value Silly goats differently
    expect(uniqueSillyValues.size).toBe(4);
  });
});
