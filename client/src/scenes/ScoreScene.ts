import Phaser from 'phaser';
import { ValueSheet, GoatType, Goat } from 'shared/types';
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

interface FinalPlayer {
  id: string;
  name: string;
  hand: Goat[];
  cash: number;
}

// Height of a collapsed card (header row only)
const COLLAPSED_H = 60;
// Height of the breakdown section per type row + cash + total + padding
function expandedH(typeCount: number): number {
  return COLLAPSED_H + 10 + 22 * (typeCount + 2) + 10; // cash + type rows + total
}

export class ScoreScene extends Phaser.Scene {
  private scores: Record<string, number> = {};
  private valueSheets: Record<string, ValueSheet> = {};
  private playerNames: Record<string, string> = {};
  private finalPlayers: FinalPlayer[] = [];
  private myPlayerId: string = '';

  // Which player cards are expanded (by playerId)
  private expandedIds: Set<string> = new Set();

  constructor() {
    super('ScoreScene');
  }

  init(data: {
    scores: Record<string, number>;
    valueSheets: Record<string, ValueSheet>;
    playerNames: Record<string, string>;
    finalPlayers: FinalPlayer[];
    myPlayerId: string;
  }) {
    this.scores = data.scores ?? {};
    this.valueSheets = data.valueSheets ?? {};
    this.playerNames = data.playerNames ?? {};
    this.finalPlayers = data.finalPlayers ?? [];
    this.myPlayerId = data.myPlayerId ?? '';
    // My card expanded by default
    this.expandedIds = new Set([this.myPlayerId]);
  }

  preload() {
    // SVG assets may already be cached from GameScene
    if (!this.textures.exists('goat-silly')) {
      this.load.svg('goat-silly',  '/assets/goats/silly.svg',  { width: 110, height: 127 });
      this.load.svg('goat-angry',  '/assets/goats/angry.svg',  { width: 110, height: 127 });
      this.load.svg('goat-happy',  '/assets/goats/happy.svg',  { width: 110, height: 127 });
      this.load.svg('goat-hungry', '/assets/goats/hungry.svg', { width: 110, height: 127 });
      this.load.svg('goat-grumpy', '/assets/goats/grumpy.svg', { width: 110, height: 127 });
    }
  }

  create() {
    playGameOverFanfare();
    this.buildScene();
  }

  private buildScene() {
    // Clear everything and rebuild (called again when a card is toggled)
    this.children.removeAll(true);

    const W = this.game.canvas.width;
    const H = this.game.canvas.height;

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
    const goatTypes = Object.values(GoatType);
    const CARD_W = W - 80;
    const CARD_GAP = 10;
    const START_Y = 84;

    let cy = START_Y;

    sorted.forEach((playerId, rank) => {
      const score = this.scores[playerId];
      const sheet = this.valueSheets[playerId] ?? ({} as ValueSheet);
      const finalPlayer = this.finalPlayers.find((p) => p.id === playerId);
      const isWinner = rank === 0;
      const isMe = playerId === this.myPlayerId;
      const isExpanded = this.expandedIds.has(playerId);
      const cardH = isExpanded ? expandedH(goatTypes.length) : COLLAPSED_H;

      const gfx = this.add.graphics();

      if (isWinner) {
        gfx.fillStyle(0xc89b2a, 0.15);
        gfx.fillRoundedRect(40, cy, CARD_W, cardH, 10);
        gfx.lineStyle(2.5, C.gold, 0.9);
        gfx.strokeRoundedRect(40, cy, CARD_W, cardH, 10);
      } else {
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillRoundedRect(43, cy + 3, CARD_W, cardH, 10);
        gfx.fillStyle(C.parchment, 1);
        gfx.fillRoundedRect(40, cy, CARD_W, cardH, 10);
        gfx.lineStyle(1.5, C.parchmentDark, 1);
        gfx.strokeRoundedRect(40, cy, CARD_W, cardH, 10);
      }

      // Header row (always visible) ─────────────────────────────────────────

      // Rank medal
      const rankLabel = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`;
      this.add.text(60, cy + COLLAPSED_H / 2, rankLabel, {
        ...ts(isWinner ? 28 : 22, C.textDark),
      }).setOrigin(0.5);

      // Player name
      const resolvedName = this.playerNames[playerId] ?? playerId.substring(0, 10);
      const nameLabel = isMe ? `You  (${resolvedName})` : resolvedName;
      this.add.text(96, cy + COLLAPSED_H / 2 - 2, nameLabel, {
        ...ts(isWinner ? 15 : 13, isMe ? '#1a5a30' : C.textDark, 'bold'),
      }).setOrigin(0, 0.5);

      // Score (right-aligned)
      this.add.text(W - 60, cy + COLLAPSED_H / 2, `${score} pts`, {
        ...ts(isWinner ? 22 : 18, isWinner ? '#c89b2a' : C.textDark, 'bold'),
      }).setOrigin(1, 0.5);

      // Toggle arrow (▼ expanded / ▶ collapsed)
      const arrowTxt = this.add.text(W - 60 - 90, cy + COLLAPSED_H / 2, isExpanded ? '▼' : '▶', {
        ...ts(13, C.textMid),
      }).setOrigin(0, 0.5);

      // Make entire header row clickable to toggle expansion
      const hitZone = this.add.rectangle(40, cy, CARD_W, COLLAPSED_H, 0x000000, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => {
        if (this.expandedIds.has(playerId)) {
          this.expandedIds.delete(playerId);
        } else {
          this.expandedIds.add(playerId);
        }
        this.buildScene();
      });

      // Value sheet dot badges (in header)
      const sheetTypes = Object.keys(sheet) as GoatType[];
      sheetTypes.sort((a, b) => sheet[b] - sheet[a]).forEach((type, i) => {
        const dotX = 96 + 180 + i * 44;
        const dotY = cy + COLLAPSED_H / 2 - 12;
        const dotGfx = this.add.graphics();
        dotGfx.fillStyle(GOAT_COLOR[type], 0.2);
        dotGfx.fillRoundedRect(dotX, dotY, 38, 24, 5);
        dotGfx.lineStyle(1.5, GOAT_COLOR[type], 0.8);
        dotGfx.strokeRoundedRect(dotX, dotY, 38, 24, 5);
        this.add.text(dotX + 19, dotY + 12, `${sheet[type]}`, {
          ...ts(11, GOAT_COLOR_CSS[type], 'bold'),
        }).setOrigin(0.5);
      });

      // Expanded breakdown section ──────────────────────────────────────────
      if (isExpanded && finalPlayer) {
        // Separator line
        const sepGfx = this.add.graphics();
        sepGfx.lineStyle(1, C.parchmentDark, 0.8);
        sepGfx.lineBetween(56, cy + COLLAPSED_H + 5, 40 + CARD_W - 16, cy + COLLAPSED_H + 5);

        let rowY = cy + COLLAPSED_H + 10;
        const LEFT = 70;
        const RIGHT = 40 + CARD_W - 20;

        // Cash row
        const cash = finalPlayer.cash;
        this.add.text(LEFT, rowY, 'Cash remaining', {
          ...ts(12, C.textMid),
        });
        this.add.text(RIGHT, rowY, `${cash} gold`, {
          ...ts(12, C.textDark, 'bold'),
        }).setOrigin(1, 0);
        rowY += 22;

        // Goat type rows
        let goatSubtotal = 0;
        for (const type of goatTypes) {
          const count = finalPlayer.hand.filter((g) => g.type === type).length;
          const valuePerGoat = sheet[type] ?? 0;
          const subtotal = count * valuePerGoat;
          goatSubtotal += subtotal;

          const typeColor = GOAT_COLOR_CSS[type];
          this.add.text(LEFT, rowY, `${type}`, {
            ...ts(12, typeColor, 'bold'),
          });
          this.add.text(LEFT + 80, rowY, `× ${count}  @  ${valuePerGoat} pts`, {
            ...ts(12, C.textMid),
          });
          this.add.text(RIGHT, rowY, `= ${subtotal} pts`, {
            ...ts(12, C.textDark, 'bold'),
          }).setOrigin(1, 0);
          rowY += 22;
        }

        // Grand total row
        const sepGfx2 = this.add.graphics();
        sepGfx2.lineStyle(1, C.parchmentDark, 0.8);
        sepGfx2.lineBetween(56, rowY + 2, 40 + CARD_W - 16, rowY + 2);
        rowY += 6;

        this.add.text(LEFT, rowY, 'Total', {
          ...ts(13, C.textDark, 'bold'),
        });
        const grandTotal = cash + goatSubtotal;
        this.add.text(RIGHT, rowY, `${grandTotal} pts`, {
          ...ts(13, isWinner ? '#c89b2a' : C.textDark, 'bold'),
        }).setOrigin(1, 0);
      }

      cy += cardH + CARD_GAP;

      // Suppress unused var lint warning
      void arrowTxt;
    });

    // Return to lobby button
    const btnY = H - 42;
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(C.woodDark, 1);
    btnGfx.fillRoundedRect(W / 2 - 100, btnY - 20, 200, 42, 10);
    btnGfx.lineStyle(2, C.gold, 0.6);
    btnGfx.strokeRoundedRect(W / 2 - 100, btnY - 20, 200, 42, 10);

    this.add.text(W / 2, btnY + 1, '← Return to Lobby', {
      ...ts(16, C.textLight, 'bold'),
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      window.location.reload();
    });
  }
}
