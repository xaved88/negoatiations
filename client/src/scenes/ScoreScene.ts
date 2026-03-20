import Phaser from 'phaser';
import { ValueSheet, GoatType } from 'shared/types';
import { playGameOverFanfare } from '../sounds';

const C = {
  fieldGreen:    0x3a5f28,
  parchment:     0xf7e8c8,
  parchmentDark: 0xe8d0a0,
  woodDark:      0x4a2e0a,
  woodMid:       0x7a4f1e,
  gold:          0xc89b2a,
  textDark:      '#2d1b0e',
  textMid:       '#6b4226',
  textLight:     '#f7e8c8',
};

const GOAT_COLOR: Record<GoatType, number> = {
  [GoatType.Silly]:  0xF5B800,
  [GoatType.Angry]:  0xE03020,
  [GoatType.Happy]:  0x22BB55,
  [GoatType.Hungry]: 0x2090D0,
  [GoatType.Grumpy]: 0x8B45B0,
};

const GOAT_COLOR_CSS: Record<GoatType, string> = {
  [GoatType.Silly]:  '#F5B800',
  [GoatType.Angry]:  '#E03020',
  [GoatType.Happy]:  '#22BB55',
  [GoatType.Hungry]: '#2090D0',
  [GoatType.Grumpy]: '#8B45B0',
};

function ts(
  size: number,
  color = C.textDark,
  weight: 'normal' | 'bold' = 'normal'
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontSize: `${size}px`,
    color,
    fontFamily: "'Nunito', Arial, sans-serif",
    fontStyle: weight === 'bold' ? 'bold' : 'normal',
    resolution: 2,
  } as Phaser.Types.GameObjects.Text.TextStyle;
}

function drawPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  opts: { headerH?: number; headerColor?: number } = {}
) {
  gfx.fillStyle(0x000000, 0.18);
  gfx.fillRoundedRect(x + 3, y + 4, w, h, 12);
  gfx.fillStyle(C.parchment, 1);
  gfx.fillRoundedRect(x, y, w, h, 12);
  gfx.lineStyle(2, C.woodMid, 0.7);
  gfx.strokeRoundedRect(x, y, w, h, 12);
  if (opts.headerH && opts.headerColor !== undefined) {
    gfx.fillStyle(opts.headerColor, 1);
    gfx.fillRoundedRect(x, y, w, opts.headerH, { tl: 12, tr: 12, bl: 0, br: 0 });
  }
}

export class ScoreScene extends Phaser.Scene {
  private scores: Record<string, number> = {};
  private valueSheets: Record<string, ValueSheet> = {};
  private playerNames: Record<string, string> = {};
  private myPlayerId: string = '';

  constructor() {
    super('ScoreScene');
  }

  init(data: { scores: Record<string, number>; valueSheets: Record<string, ValueSheet>; playerNames: Record<string, string>; myPlayerId: string }) {
    this.scores = data.scores ?? {};
    this.valueSheets = data.valueSheets ?? {};
    this.playerNames = data.playerNames ?? {};
    this.myPlayerId = data.myPlayerId ?? '';
  }

  preload() {
    // SVG assets may already be cached from GameScene; load anyway in case
    if (!this.textures.exists('goat-silly')) {
      this.load.svg('goat-silly',  '/assets/goats/silly.svg',  { width: 110, height: 127 });
      this.load.svg('goat-angry',  '/assets/goats/angry.svg',  { width: 110, height: 127 });
      this.load.svg('goat-happy',  '/assets/goats/happy.svg',  { width: 110, height: 127 });
      this.load.svg('goat-hungry', '/assets/goats/hungry.svg', { width: 110, height: 127 });
      this.load.svg('goat-grumpy', '/assets/goats/grumpy.svg', { width: 110, height: 127 });
    }
  }

  create() {
    const W = this.game.canvas.width;
    const H = this.game.canvas.height;

    // Play fanfare
    playGameOverFanfare();

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, C.fieldGreen);

    // Top banner
    const bannerGfx = this.add.graphics();
    bannerGfx.fillStyle(C.woodDark, 1);
    bannerGfx.fillRect(0, 0, W, 72);
    bannerGfx.lineStyle(3, C.woodMid, 0.8);
    bannerGfx.lineBetween(0, 72, W, 72);
    bannerGfx.lineStyle(1, C.gold, 0.5);
    bannerGfx.lineBetween(0, 69, W, 69);

    this.add.text(W / 2, 36, '🏆  Game Over!', {
      ...ts(28, C.textLight, 'bold'),
    }).setOrigin(0.5);

    // Sort by score
    const sorted = Object.keys(this.scores).sort((a, b) => this.scores[b] - this.scores[a]);

    const CARD_W = W - 80;
    const CARD_H = 88;
    const CARD_GAP = 10;
    const START_Y = 90;

    sorted.forEach((playerId, rank) => {
      const score = this.scores[playerId];
      const sheet = this.valueSheets[playerId] ?? {};
      const isWinner = rank === 0;
      const isMe = playerId === this.myPlayerId;
      const cy = START_Y + rank * (CARD_H + CARD_GAP);

      const gfx = this.add.graphics();

      // Highlight winner with gold border
      if (isWinner) {
        gfx.fillStyle(0xc89b2a, 0.15);
        gfx.fillRoundedRect(40, cy, CARD_W, CARD_H, 10);
        gfx.lineStyle(2.5, C.gold, 0.9);
        gfx.strokeRoundedRect(40, cy, CARD_W, CARD_H, 10);
      } else {
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillRoundedRect(43, cy + 3, CARD_W, CARD_H, 10);
        gfx.fillStyle(C.parchment, 1);
        gfx.fillRoundedRect(40, cy, CARD_W, CARD_H, 10);
        gfx.lineStyle(1.5, C.parchmentDark, 1);
        gfx.strokeRoundedRect(40, cy, CARD_W, CARD_H, 10);
      }

      // Rank medal / number
      const rankLabel = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`;
      this.add.text(60, cy + CARD_H / 2, rankLabel, {
        ...ts(isWinner ? 28 : 22, C.textDark),
      }).setOrigin(0.5);

      // Player name
      const resolvedName = this.playerNames[playerId] ?? playerId.substring(0, 10);
      const nameLabel = isMe ? `You  (${resolvedName})` : resolvedName;
      this.add.text(96, cy + 16, nameLabel, {
        ...ts(isWinner ? 16 : 14, isMe ? '#1a5a30' : C.textDark, 'bold'),
      });

      // Value sheet dots
      const sheetTypes = Object.keys(sheet) as GoatType[];
      sheetTypes.sort((a, b) => sheet[b] - sheet[a]).forEach((type, i) => {
        const dotX = 96 + i * 46;
        const dotY = cy + 44;
        const dotGfx = this.add.graphics();
        dotGfx.fillStyle(GOAT_COLOR[type], 0.2);
        dotGfx.fillRoundedRect(dotX, dotY, 40, 24, 5);
        dotGfx.lineStyle(1.5, GOAT_COLOR[type], 0.8);
        dotGfx.strokeRoundedRect(dotX, dotY, 40, 24, 5);
        this.add.text(dotX + 20, dotY + 12, `${sheet[type]}`, {
          ...ts(11, GOAT_COLOR_CSS[type], 'bold'),
        }).setOrigin(0.5);
      });

      // Score
      this.add.text(W - 60, cy + CARD_H / 2, `${score} pts`, {
        ...ts(isWinner ? 22 : 18, isWinner ? '#c89b2a' : C.textDark, 'bold'),
      }).setOrigin(1, 0.5);
    });

    // Return to lobby button
    const btnY = H - 52;
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(C.woodDark, 1);
    btnGfx.fillRoundedRect(W / 2 - 100, btnY - 20, 200, 42, 10);
    btnGfx.lineStyle(2, C.gold, 0.6);
    btnGfx.strokeRoundedRect(W / 2 - 100, btnY - 20, 200, 42, 10);

    const returnBtn = this.add.text(W / 2, btnY + 1, '← Return to Lobby', {
      ...ts(16, C.textLight, 'bold'),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      window.location.reload();
    });
  }
}
