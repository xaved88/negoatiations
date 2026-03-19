import { nextAuctioneerIndex, isGameOver } from '../src/logic/turns';
import { TURNS_PER_GAME } from 'shared/constants';

describe('nextAuctioneerIndex', () => {
  it('should advance to next player', () => {
    const next = nextAuctioneerIndex(0, 4);
    expect(next).toBe(1);
  });

  it('should wrap around at end', () => {
    const next = nextAuctioneerIndex(3, 4);
    expect(next).toBe(0);
  });

  it('should work with 2 players', () => {
    expect(nextAuctioneerIndex(0, 2)).toBe(1);
    expect(nextAuctioneerIndex(1, 2)).toBe(0);
  });

  it('should work with 5 players', () => {
    expect(nextAuctioneerIndex(0, 5)).toBe(1);
    expect(nextAuctioneerIndex(4, 5)).toBe(0);
  });

  it('should be consistent across multiple calls', () => {
    let current = 0;
    for (let i = 0; i < 10; i++) {
      current = nextAuctioneerIndex(current, 4);
    }
    expect(current).toBe(2); // (0 + 10) % 4
  });
});

describe('isGameOver', () => {
  it('should return false when turns < TURNS_PER_GAME', () => {
    expect(isGameOver(0)).toBe(false);
    expect(isGameOver(TURNS_PER_GAME - 1)).toBe(false);
  });

  it('should return true when turns >= TURNS_PER_GAME', () => {
    expect(isGameOver(TURNS_PER_GAME)).toBe(true);
    expect(isGameOver(TURNS_PER_GAME + 1)).toBe(true);
  });

  it('should return true at exactly TURNS_PER_GAME', () => {
    expect(isGameOver(TURNS_PER_GAME)).toBe(true);
  });
});
