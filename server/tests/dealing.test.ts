import { dealHands } from '../src/logic/dealing';
import { GoatType } from 'shared/types';

describe('dealHands', () => {
  it('should return correct number of hands', () => {
    const hands = dealHands(2, 5);
    expect(hands).toHaveLength(2);
  });

  it('should deal correct number of goats per hand', () => {
    const hands = dealHands(3, 5);
    expect(hands[0]).toHaveLength(5);
    expect(hands[1]).toHaveLength(5);
    expect(hands[2]).toHaveLength(5);
  });

  it('should not duplicate goat IDs', () => {
    const hands = dealHands(4, 5);
    const allGoats = hands.flat();
    const ids = allGoats.map((g) => g.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should distribute goat types evenly', () => {
    const hands = dealHands(4, 4);
    const allGoats = hands.flat();
    const typeCounts: Record<string, number> = {};
    const types = Object.values(GoatType);

    for (const type of types) {
      typeCounts[type] = 0;
    }

    for (const goat of allGoats) {
      typeCounts[goat.type]++;
    }

    // With 4 players * 4 goats and 4 types, should be 4 of each
    for (const type of types) {
      expect(typeCounts[type]).toBe(4);
    }
  });

  it('should handle single player', () => {
    const hands = dealHands(1, 5);
    expect(hands).toHaveLength(1);
    expect(hands[0]).toHaveLength(5);
  });

  it('should assign valid goat types', () => {
    const hands = dealHands(2, 5);
    const validTypes = Object.values(GoatType);
    for (const hand of hands) {
      for (const goat of hand) {
        expect(validTypes).toContain(goat.type);
      }
    }
  });
});
