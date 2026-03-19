import { PlayerState, ValueSheet } from 'shared/types';

export function computeScores(
  players: PlayerState[],
  valueSheets: Record<string, ValueSheet>
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const player of players) {
    const sheet = valueSheets[player.id];
    if (!sheet) {
      scores[player.id] = player.cash;
      continue;
    }

    let goatValue = 0;
    for (const goat of player.hand) {
      goatValue += sheet[goat.type];
    }

    scores[player.id] = player.cash + goatValue;
  }

  return scores;
}
