import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { GameScene } from './scenes/GameScene';
import { ScoreScene } from './scenes/ScoreScene';

export function startGame(room: Room): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 800,
    parent: 'game-container',
    backgroundColor: '#3a5f28',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      new GameScene(room),
      new ScoreScene(),
    ],
    render: {
      pixelArt: false,
      antialias: true,
    },
  };

  return new Phaser.Game(config);
}
