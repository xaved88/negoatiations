import { computeScores } from '../src/logic/scoring';
import { PlayerState, ValueSheet, GoatType } from 'shared/types';

describe('computeScores', () => {
  const players: PlayerState[] = [
    {
      id: 'p1',
      name: 'Alice',
      hand: [
        { id: 'g1', type: GoatType.Silly },
        { id: 'g2', type: GoatType.Happy },
      ],
      cash: 50,
      isBot: false,
    },
    {
      id: 'p2',
      name: 'Bob',
      hand: [
        { id: 'g3', type: GoatType.Angry },
        { id: 'g4', type: GoatType.Hungry },
      ],
      cash: 30,
      isBot: false,
    },
  ];

  const valueSheets: Record<string, ValueSheet> = {
    p1: {
      [GoatType.Silly]: 4,
      [GoatType.Angry]: 1,
      [GoatType.Happy]: 2,
      [GoatType.Hungry]: 3,
    },
    p2: {
      [GoatType.Silly]: 1,
      [GoatType.Angry]: 4,
      [GoatType.Happy]: 3,
      [GoatType.Hungry]: 2,
    },
  };

  it('should calculate scores correctly', () => {
    const scores = computeScores(players, valueSheets);

    // Alice: 50 cash + 4 (Silly) + 2 (Happy) = 56
    expect(scores['p1']).toBe(56);

    // Bob: 30 cash + 4 (Angry) + 2 (Hungry) = 36
    expect(scores['p2']).toBe(36);
  });

  it('should return correct scores object keys', () => {
    const scores = computeScores(players, valueSheets);
    expect(Object.keys(scores)).toContain('p1');
    expect(Object.keys(scores)).toContain('p2');
  });

  it('should handle empty hands', () => {
    const emptyHandPlayers: PlayerState[] = [
      {
        id: 'p1',
        name: 'Alice',
        hand: [],
        cash: 100,
        isBot: false,
      },
    ];

    const sheets: Record<string, ValueSheet> = {
      p1: {
        [GoatType.Silly]: 1,
        [GoatType.Angry]: 2,
        [GoatType.Happy]: 3,
        [GoatType.Hungry]: 4,
      },
    };

    const scores = computeScores(emptyHandPlayers, sheets);
    expect(scores['p1']).toBe(100); // just the cash
  });

  it('should handle zero cash', () => {
    const zeroCashPlayers: PlayerState[] = [
      {
        id: 'p1',
        name: 'Alice',
        hand: [
          { id: 'g1', type: GoatType.Silly },
          { id: 'g2', type: GoatType.Happy },
        ],
        cash: 0,
        isBot: false,
      },
    ];

    const sheets: Record<string, ValueSheet> = {
      p1: {
        [GoatType.Silly]: 3,
        [GoatType.Angry]: 1,
        [GoatType.Happy]: 4,
        [GoatType.Hungry]: 2,
      },
    };

    const scores = computeScores(zeroCashPlayers, sheets);
    expect(scores['p1']).toBe(7); // 3 + 4
  });

  it('should handle multiple goats of same type', () => {
    const sameTypePlayers: PlayerState[] = [
      {
        id: 'p1',
        name: 'Alice',
        hand: [
          { id: 'g1', type: GoatType.Silly },
          { id: 'g2', type: GoatType.Silly },
          { id: 'g3', type: GoatType.Silly },
        ],
        cash: 10,
        isBot: false,
      },
    ];

    const sheets: Record<string, ValueSheet> = {
      p1: {
        [GoatType.Silly]: 5,
        [GoatType.Angry]: 1,
        [GoatType.Happy]: 2,
        [GoatType.Hungry]: 3,
      },
    };

    const scores = computeScores(sameTypePlayers, sheets);
    expect(scores['p1']).toBe(25); // 10 + 5 + 5 + 5
  });
});
