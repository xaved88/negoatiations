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
  it('should return false when fewer than TURNS_PER_GAME full rounds have completed', () => {
    expect(isGameOver(0, 5)).toBe(false);
    expect(isGameOver(4, 5)).toBe(false); // 4 auctions with 5 players = 0 full rounds
    expect(isGameOver(TURNS_PER_GAME * 5 - 1, 5)).toBe(false); // one auction short
  });

  it('should return true when TURNS_PER_GAME full rounds have completed', () => {
    expect(isGameOver(TURNS_PER_GAME * 5, 5)).toBe(true);
    expect(isGameOver(TURNS_PER_GAME * 5 + 1, 5)).toBe(true);
  });

  it('should return true at exactly TURNS_PER_GAME rounds', () => {
    expect(isGameOver(TURNS_PER_GAME * 5, 5)).toBe(true);
  });

  it('game is not over after first N auctions when there are 5 players', () => {
    // 5 auctions = 1 full round; game requires TURNS_PER_GAME rounds so only false if TURNS_PER_GAME > 1
    expect(isGameOver(5, 5)).toBe(TURNS_PER_GAME <= 1);
  });

  it('should work correctly with 2 players', () => {
    expect(isGameOver(0, 2)).toBe(false);
    expect(isGameOver(1, 2)).toBe(false); // 1 auction, not a full round yet
    expect(isGameOver(TURNS_PER_GAME * 2, 2)).toBe(true);
  });
});
