import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { GameScene } from './scenes/GameScene';
import { ScoreScene } from './scenes/ScoreScene';

export function startGame(room: Room): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: 'game-container',
    scene: [
      new GameScene(room),
      new ScoreScene(),
    ],
    render: {
      pixelArt: false,
      antialias: true,
    },
  };

  const game = new Phaser.Game(config);
  return game;
}
