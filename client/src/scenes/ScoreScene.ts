import Phaser from 'phaser';
import { ValueSheet, GoatType } from 'shared/types';

export class ScoreScene extends Phaser.Scene {
  private scores: Record<string, number> = {};
  private valueSheets: Record<string, ValueSheet> = {};
  private myPlayerId: string = '';
  private playerNames: Record<string, string> = {};

  constructor() {
    super('ScoreScene');
  }

  init(data: any) {
    this.scores = data.scores || {};
    this.valueSheets = data.valueSheets || {};
    this.myPlayerId = data.myPlayerId || '';
  }

  create() {
    const width = this.game.canvas.width;
    const height = this.game.canvas.height;

    // Background
    this.add.rectangle(0, 0, width, height, 0xf0f0f0).setOrigin(0);

    // Title
    const title = this.add.text(width / 2, 40, 'Game Over!', {
      fontSize: '48px',
      color: '#333',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Sort players by score (descending)
    const sortedPlayerIds = Object.keys(this.scores).sort(
      (a, b) => this.scores[b] - this.scores[a]
    );

    let y = 120;
    let rank = 1;

    for (const playerId of sortedPlayerIds) {
      const score = this.scores[playerId];
      const isWinner = rank === 1;
      const winnerText = isWinner ? '👑 ' : '';

      const playerText = this.add.text(40, y, `${rank}. Player (ID: ${playerId.substring(0, 8)})`, {
        fontSize: '18px',
        color: isWinner ? '#FFD700' : '#333',
        fontStyle: isWinner ? 'bold' : 'normal',
      }).setOrigin(0);

      const scoreText = this.add.text(width - 40, y, `${score} pts`, {
        fontSize: '18px',
        color: isWinner ? '#FFD700' : '#333',
        fontStyle: isWinner ? 'bold' : 'normal',
      }).setOrigin(1, 0);

      // Show value sheet for this player
      const sheet = this.valueSheets[playerId];
      if (sheet) {
        const sheetStr = Object.entries(sheet)
          .map(([type, val]) => `${type}: ${val}`)
          .join(' | ');
        const sheetText = this.add.text(40, y + 30, sheetStr, {
          fontSize: '12px',
          color: '#888',
        }).setOrigin(0);
      }

      y += 80;
      rank++;
    }

    // Return to lobby button
    const returnBtn = this.add
      .text(width / 2, height - 40, 'Return to Lobby', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#667eea',
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.reload();
      });
  }
}
