import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { GameState, GoatType, Bid, ValueSheet, PlayerState } from 'shared/types';
import { BID_LOCK_SECONDS } from 'shared/constants';
import { playBidPlaced, playAuctionAccepted, playBidRejected } from '../sounds';

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  fieldGreen:    0x3a5f28,
  fieldGreenLt:  0x4d7a35,
  parchment:     0xf7e8c8,
  parchmentDark: 0xe8d0a0,
  woodDark:      0x4a2e0a,
  woodMid:       0x7a4f1e,
  gold:          0xc89b2a,
  textDark:      '#2d1b0e',
  textMid:       '#6b4226',
  textLight:     '#f7e8c8',
  white:         '#ffffff',
  greenAction:   0x1e7a3a,
  redAction:     0xb03020,
  amberAction:   0xcc8800,
  greyAction:    0x7a6a5a,
};

// Goat type → accent colour (border, hair, ear fill)
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

// SVG asset key per goat type
const GOAT_SVG_KEY: Record<GoatType, string> = {
  [GoatType.Silly]:  'goat-silly',
  [GoatType.Angry]:  'goat-angry',
  [GoatType.Happy]:  'goat-happy',
  [GoatType.Hungry]: 'goat-hungry',
  [GoatType.Grumpy]: 'goat-grumpy',
};

// ── Layout constants ───────────────────────────────────────────────────────
const W = 1280;
const H = 800;
const TOP_BAR_H = 68;
const LEFT_W = 230;
const RIGHT_W = 290;
const CENTER_X = LEFT_W;
const CENTER_W = W - LEFT_W - RIGHT_W;
const CONTENT_Y = TOP_BAR_H + 8;
const CONTENT_H = H - CONTENT_Y - 8;

// ── Text style helpers ─────────────────────────────────────────────────────
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
  };
}

// ── Panel drawing helper ───────────────────────────────────────────────────
function drawPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { headerH?: number; headerColor?: number } = {}
) {
  // Shadow
  gfx.fillStyle(0x000000, 0.18);
  gfx.fillRoundedRect(x + 3, y + 4, w, h, 10);
  // Body
  gfx.fillStyle(C.parchment, 1);
  gfx.fillRoundedRect(x, y, w, h, 10);
  // Border
  gfx.lineStyle(2, C.woodMid, 0.7);
  gfx.strokeRoundedRect(x, y, w, h, 10);
  // Optional coloured header band
  if (opts.headerH && opts.headerColor !== undefined) {
    gfx.fillStyle(opts.headerColor, 1);
    gfx.fillRoundedRect(x, y, w, opts.headerH, { tl: 10, tr: 10, bl: 0, br: 0 });
  }
}

// ── Button helper ──────────────────────────────────────────────────────────
function makeBtn(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  bgColor: number,
  onClick: () => void,
  opts: { w?: number; h?: number } = {}
): Phaser.GameObjects.Container {
  const bw = opts.w ?? 90;
  const bh = opts.h ?? 28;

  const gfx = scene.add.graphics();
  gfx.fillStyle(bgColor, 1);
  gfx.fillRoundedRect(0, 0, bw, bh, 6);
  // Bottom shadow
  gfx.fillStyle(0x000000, 0.2);
  gfx.fillRoundedRect(0, bh - 4, bw, 4, { tl: 0, tr: 0, bl: 6, br: 6 });

  const txt = scene.add.text(bw / 2, bh / 2 - 1, label, {
    ...ts(12, C.white, 'bold'),
    resolution: 2,
  }).setOrigin(0.5);

  const c = scene.add.container(x, y, [gfx, txt]);
  c.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, bw, bh),
    Phaser.Geom.Rectangle.Contains
  ).on('pointerdown', onClick);
  return c;
}

// ── Goat card drawing helper ───────────────────────────────────────────────
function drawGoatCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  goatType: GoatType,
  opts: {
    label?: string;
    sublabel?: string;
    width?: number;
    height?: number;
    interactive?: boolean;
    onClick?: () => void;
    dimmed?: boolean;
  } = {}
): Phaser.GameObjects.Container {
  const cw = opts.width ?? 160;
  const ch = opts.height ?? 84;
  const accentColor = GOAT_COLOR[goatType];
  const imgKey = GOAT_SVG_KEY[goatType];
  const alpha = opts.dimmed ? 0.45 : 1;

  const gfx = scene.add.graphics().setAlpha(alpha);

  // Card shadow
  gfx.fillStyle(0x000000, 0.18);
  gfx.fillRoundedRect(3, 4, cw, ch, 8);

  // Card body — parchment
  gfx.fillStyle(C.parchment, 1);
  gfx.fillRoundedRect(0, 0, cw, ch, 8);

  // Left accent strip (goat colour)
  gfx.fillStyle(accentColor, 1);
  gfx.fillRoundedRect(0, 0, 8, ch, { tl: 8, tr: 0, bl: 8, br: 0 });

  // Border
  gfx.lineStyle(1.5, C.parchmentDark, 1);
  gfx.strokeRoundedRect(0, 0, cw, ch, 8);

  const children: Phaser.GameObjects.GameObject[] = [gfx];

  // Goat face image — right-aligned in the card
  const imgSize = ch - 8;
  if (scene.textures.exists(imgKey)) {
    const img = scene.add.image(cw - imgSize / 2 - 4, ch / 2, imgKey)
      .setDisplaySize(imgSize, imgSize)
      .setAlpha(alpha);
    children.push(img);
  }

  // Type label
  const labelText = opts.label ?? goatType;
  const lbl = scene.add.text(14, ch / 2 - (opts.sublabel ? 10 : 0), labelText, {
    ...ts(13, C.textDark, 'bold'),
    resolution: 2,
  }).setAlpha(alpha);
  children.push(lbl);

  if (opts.sublabel) {
    const sub = scene.add.text(14, ch / 2 + 10, opts.sublabel, {
      ...ts(11, C.textMid),
      resolution: 2,
    }).setAlpha(alpha);
    children.push(sub);
  }

  const container = scene.add.container(x, y, children);

  if (opts.interactive && opts.onClick) {
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, cw, ch),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerdown', opts.onClick);
    container.on('pointerover', () => {
      scene.input.setDefaultCursor('pointer');
      gfx.clear();
      gfx.fillStyle(0x000000, 0.18);
      gfx.fillRoundedRect(3, 4, cw, ch, 8);
      gfx.fillStyle(C.parchment, 1);
      gfx.fillRoundedRect(0, 0, cw, ch, 8);
      gfx.fillStyle(accentColor, 1);
      gfx.fillRoundedRect(0, 0, 8, ch, { tl: 8, tr: 0, bl: 8, br: 0 });
      gfx.lineStyle(2.5, accentColor, 1);
      gfx.strokeRoundedRect(0, 0, cw, ch, 8);
    });
    container.on('pointerout', () => {
      scene.input.setDefaultCursor('default');
      gfx.clear();
      gfx.fillStyle(0x000000, 0.18);
      gfx.fillRoundedRect(3, 4, cw, ch, 8);
      gfx.fillStyle(C.parchment, 1);
      gfx.fillRoundedRect(0, 0, cw, ch, 8);
      gfx.fillStyle(accentColor, 1);
      gfx.fillRoundedRect(0, 0, 8, ch, { tl: 8, tr: 0, bl: 8, br: 0 });
      gfx.lineStyle(1.5, C.parchmentDark, 1);
      gfx.strokeRoundedRect(0, 0, cw, ch, 8);
    });
  }

  return container;
}

// ── Scene ──────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  private room!: Room<GameState>;
  private gameState: GameState | null = null;
  private myPlayerId: string = '';
  private myValueSheet: ValueSheet | null = null;

  // UI containers
  private topBarGfx!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private handContainer!: Phaser.GameObjects.Container;
  private auctionContainer!: Phaser.GameObjects.Container;
  private rightContainer!: Phaser.GameObjects.Container;

  // DOM overlays for bid composition
  private bidInputOverlay: HTMLInputElement | null = null;
  private goatSelectorOverlay: HTMLDivElement | null = null;

  private selectedBidGoatIds: Set<string> = new Set();
  private lockCountdownText: Phaser.GameObjects.Text | null = null;
  private bidLockTimeout: ReturnType<typeof setTimeout> | null = null;

  // Flash overlay for visual feedback
  private flashRect!: Phaser.GameObjects.Rectangle;

  constructor(room: Room<GameState>) {
    super('GameScene');
    this.room = room;
  }

  preload() {
    this.load.svg('goat-silly',  '/assets/goats/silly.svg',  { width: 110, height: 127 });
    this.load.svg('goat-angry',  '/assets/goats/angry.svg',  { width: 110, height: 127 });
    this.load.svg('goat-happy',  '/assets/goats/happy.svg',  { width: 110, height: 127 });
    this.load.svg('goat-hungry', '/assets/goats/hungry.svg', { width: 110, height: 127 });
    this.load.svg('goat-grumpy', '/assets/goats/grumpy.svg', { width: 110, height: 127 });
  }

  create() {
    this.myPlayerId = this.room.sessionId;

    this.room.onMessage('stateUpdate', (newState: GameState) => {
      this.gameState = newState;
      this.updateUI();
    });

    this.room.send('RequestState', {});

    this.room.onMessage('yourValueSheet', (sheet: ValueSheet) => {
      this.myValueSheet = sheet;
      this.updateUI();
    });

    this.room.onMessage('bidAccepted', () => {
      playAuctionAccepted();
      this.flashScreen(0x22bb55, 0.25);
    });

    this.room.onMessage('bidRejected', () => {
      playBidRejected();
      this.flashScreen(0xcc2200, 0.25);
    });

    this.room.onMessage('gameOver', (data: any) => {
      this.cleanupDomOverlays();
      this.scene.start('ScoreScene', {
        scores: data.scores,
        valueSheets: data.valueSheets,
        playerNames: data.playerNames ?? {},
        myPlayerId: this.myPlayerId,
      });
    });

    this.createStaticUI();
    this.updateUI();

    // Debug handle — lets preview_eval drive the game without needing real pointer events
    (window as any).__game = {
      startGame:        () => this.room.send('StartGame', {}),
      putUpForAuction:  (goatId: string) => this.room.send('PutUpForAuction', { goatId }),
      placeBid:         (goatId: string, cashOffer: number, giveGoatId?: string) =>
        this.room.send('PlaceBid', { goatId, cashOffer, giveGoatId }),
      getState:         () => this.gameState,
      getSheet:         () => this.myValueSheet,
    };
  }

  update() {
    // Auction timer countdown
    if (this.gameState?.auction?.timerEndsAt && this.timerText) {
      const secondsLeft = Math.max(
        0,
        Math.ceil((this.gameState.auction.timerEndsAt - Date.now()) / 1000)
      );
      this.timerText.setText(`⏱  ${secondsLeft}s`);
      this.timerText.setColor(secondsLeft <= 10 ? '#ff6644' : C.textLight);
      this.timerText.setVisible(true);
    }

    // Bid lock countdown
    if (this.lockCountdownText?.active) {
      const auction = this.gameState?.auction;
      const myBid = auction?.bids.find((b) => b.bidderId === this.myPlayerId);
      if (myBid?.bidPlacedAt) {
        const lockedFor = Math.max(
          0,
          Math.ceil((myBid.bidPlacedAt + BID_LOCK_SECONDS * 1000 - Date.now()) / 1000)
        );
        this.lockCountdownText.setText(`Can retract in ${lockedFor}s`);
      }
    }
  }

  // ── Static chrome (drawn once) ─────────────────────────────────────────
  private createStaticUI() {
    // Field green background
    this.add.rectangle(W / 2, H / 2, W, H, C.fieldGreen);

    // Top bar
    const topGfx = this.add.graphics();
    topGfx.fillStyle(C.woodDark, 1);
    topGfx.fillRect(0, 0, W, TOP_BAR_H);
    topGfx.lineStyle(3, C.woodMid, 0.8);
    topGfx.lineBetween(0, TOP_BAR_H, W, TOP_BAR_H);
    // Gold inset line
    topGfx.lineStyle(1, C.gold, 0.5);
    topGfx.lineBetween(0, TOP_BAR_H - 3, W, TOP_BAR_H - 3);
    this.topBarGfx = topGfx;

    // Title / game name
    this.add.text(W / 2, TOP_BAR_H / 2, '🐐  Negoatiations', {
      ...ts(20, C.textLight, 'bold'),
      resolution: 2,
    }).setOrigin(0.5);

    // Player info (left of bar)
    this.infoText = this.add.text(14, TOP_BAR_H / 2, '', {
      ...ts(14, C.textLight),
      resolution: 2,
    }).setOrigin(0, 0.5);

    // Turn info + timer (right of bar)
    this.turnText = this.add.text(W - 160, TOP_BAR_H / 2, '', {
      ...ts(13, C.textLight),
      resolution: 2,
    }).setOrigin(1, 0.5);

    this.timerText = this.add.text(W - 14, TOP_BAR_H / 2, '', {
      ...ts(15, C.textLight, 'bold'),
      resolution: 2,
    }).setOrigin(1, 0.5).setVisible(false);

    // Containers for dynamic content
    this.handContainer    = this.add.container(0, 0);
    this.auctionContainer = this.add.container(0, 0);
    this.rightContainer   = this.add.container(0, 0);

    // Full-screen flash rect (starts invisible)
    this.flashRect = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0);
  }

  // ── Flash feedback ─────────────────────────────────────────────────────
  private flashScreen(color: number, intensity: number) {
    this.flashRect.setFillStyle(color, intensity);
    this.tweens.add({
      targets: this.flashRect,
      alpha: { from: 1, to: 0 },
      duration: 350,
      ease: 'Power2',
      onComplete: () => this.flashRect.setAlpha(1),
    });
  }

  // ── UI update (called on every state push) ─────────────────────────────
  private updateUI() {
    if (!this.gameState) return;
    const state = this.gameState;

    const myPlayer = state.players.find((p) => p.id === this.myPlayerId);
    const auctioneerIdx = state.currentAuctioneerIndex;
    const auctioneerName = state.players[auctioneerIdx]?.name ?? '…';
    const isMyTurn = state.players[auctioneerIdx]?.id === this.myPlayerId;

    // ── Top bar ──
    if (myPlayer) {
      this.infoText.setText(
        `${myPlayer.name}   ·   💰 ${myPlayer.cash}   ·   🐐 ${myPlayer.hand.length}`
      );
    }
    if (state.phase === 'lobby') {
      this.turnText.setText('Waiting for players…');
    } else if (state.phase === 'playing') {
      this.turnText.setText(
        isMyTurn ? 'Your turn to auction!' : `${auctioneerName}'s turn  (Turn ${state.turnNumber})`
      );
    }
    if (!state.auction?.timerEndsAt) {
      this.timerText.setVisible(false);
    }

    // ── Panels ──
    this.buildHandPanel(myPlayer, isMyTurn);

    if (state.phase === 'lobby') {
      this.buildLobbyCenter();
    } else if (state.auction && state.phase === 'playing') {
      this.buildAuctionCenter(state, isMyTurn, myPlayer);
    } else {
      this.buildWaitingCenter();
    }

    this.buildRightPanel(state, myPlayer);
  }

  // ── Left: Your Hand ───────────────────────────────────────────────────
  private buildHandPanel(myPlayer: PlayerState | undefined, isMyTurn: boolean) {
    this.handContainer.removeAll(true);
    this.lockCountdownText = null;

    const gfx = this.add.graphics();
    const panelX = 8;
    const panelY = CONTENT_Y;
    const panelW = LEFT_W - 16;
    const panelH = CONTENT_H;
    drawPanel(gfx, panelX, panelY, panelW, panelH, {
      headerH: 38,
      headerColor: C.woodDark,
    });
    const headerLbl = this.add.text(
      panelX + panelW / 2, panelY + 19, 'YOUR HAND', {
        ...ts(12, C.textLight, 'bold'),
        resolution: 2,
      }
    ).setOrigin(0.5);
    this.handContainer.add([gfx, headerLbl]);

    if (!myPlayer || myPlayer.hand.length === 0) {
      const emptyTxt = this.add.text(panelX + panelW / 2, panelY + panelH / 2, 'No goats!', {
        ...ts(13, C.textMid),
        resolution: 2,
      }).setOrigin(0.5);
      this.handContainer.add(emptyTxt);
      return;
    }

    const CARD_W = panelW - 20;
    const CARD_H = this.myValueSheet ? 76 : 60;
    const CARD_GAP = 8;
    let cy = panelY + 48;

    for (const goat of myPlayer.hand) {
      const sublabel = this.myValueSheet
        ? `${this.myValueSheet[goat.type]} pts`
        : undefined;
      const card = drawGoatCard(this, panelX + 10, cy, goat.type, {
        label: goat.type,
        sublabel,
        width: CARD_W,
        height: CARD_H,
        interactive: isMyTurn,
        onClick: isMyTurn
          ? () => this.room.send('PutUpForAuction', { goatId: goat.id })
          : undefined,
      });
      this.handContainer.add(card);
      cy += CARD_H + CARD_GAP;
    }

    if (isMyTurn && !this.gameState?.auction) {
      const hint = this.add.text(panelX + panelW / 2, cy + 4, '↑ Tap a goat to auction', {
        ...ts(11, C.textMid),
        resolution: 2,
      }).setOrigin(0.5);
      this.handContainer.add(hint);
    }
  }

  // ── Center: Lobby waiting ─────────────────────────────────────────────
  private buildLobbyCenter() {
    this.auctionContainer.removeAll(true);
    this.hideBidComposerOverlays();

    const gfx = this.add.graphics();
    const px = CENTER_X + 8, py = CONTENT_Y, pw = CENTER_W - 16, ph = CONTENT_H;
    drawPanel(gfx, px, py, pw, ph, { headerH: 38, headerColor: C.woodDark });
    this.auctionContainer.add(gfx);

    const lbl = this.add.text(px + pw / 2, py + 19, 'AUCTION BLOCK', {
      ...ts(12, C.textLight, 'bold'), resolution: 2,
    }).setOrigin(0.5);
    this.auctionContainer.add(lbl);

    const cx = px + pw / 2;
    const isHost = this.gameState?.hostPlayerId === this.myPlayerId;

    const goatEmoji = this.add.text(cx, py + ph / 2 - 50, '🐐', { fontSize: '64px' }).setOrigin(0.5);
    const waitText = this.add.text(cx, py + ph / 2 + 30, 'Waiting for the game to start…', {
      ...ts(16, C.textMid), resolution: 2,
    }).setOrigin(0.5);
    this.auctionContainer.add([goatEmoji, waitText]);

    if (isHost) {
      const btn = makeBtn(this, cx - 60, py + ph / 2 + 60, 'Start Game', C.greenAction, () => {
        this.room.send('StartGame', {});
      }, { w: 120, h: 36 });
      this.auctionContainer.add(btn);
    } else {
      const waitHost = this.add.text(cx, py + ph / 2 + 72, 'Waiting for host…', {
        ...ts(13, C.textMid), fontStyle: 'italic', resolution: 2,
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);
      this.auctionContainer.add(waitHost);
    }
  }

  // ── Center: No auction active ─────────────────────────────────────────
  private buildWaitingCenter() {
    this.auctionContainer.removeAll(true);
    this.hideBidComposerOverlays();
    this.timerText.setVisible(false);

    const gfx = this.add.graphics();
    const px = CENTER_X + 8, py = CONTENT_Y, pw = CENTER_W - 16, ph = CONTENT_H;
    drawPanel(gfx, px, py, pw, ph, { headerH: 38, headerColor: C.woodDark });
    this.auctionContainer.add(gfx);

    const lbl = this.add.text(px + pw / 2, py + 19, 'AUCTION BLOCK', {
      ...ts(12, C.textLight, 'bold'), resolution: 2,
    }).setOrigin(0.5);
    const msg = this.add.text(px + pw / 2, py + ph / 2, 'Waiting for next auction…', {
      ...ts(15, C.textMid), resolution: 2,
    }).setOrigin(0.5);
    this.auctionContainer.add([lbl, msg]);
  }

  // ── Center: Active auction ─────────────────────────────────────────────
  private buildAuctionCenter(
    state: GameState,
    isMyTurn: boolean,
    myPlayer: PlayerState | undefined
  ) {
    this.auctionContainer.removeAll(true);
    this.lockCountdownText = null;

    const auction = state.auction!;
    const amAuctioneer = myPlayer?.id === auction.auctioneerPlayerId;

    const gfx = this.add.graphics();
    const px = CENTER_X + 8, py = CONTENT_Y, pw = CENTER_W - 16, ph = CONTENT_H;
    drawPanel(gfx, px, py, pw, ph, { headerH: 38, headerColor: C.woodDark });
    this.auctionContainer.add(gfx);

    // Panel header
    const lbl = this.add.text(px + pw / 2, py + 19, 'AUCTION BLOCK', {
      ...ts(12, C.textLight, 'bold'), resolution: 2,
    }).setOrigin(0.5);
    this.auctionContainer.add(lbl);

    let cy = py + 50;

    // ── Goat on offer ──
    const auctioneer = state.players.find((p) => p.id === auction.auctioneerPlayerId);
    const auctioneerLabel = amAuctioneer ? 'You are auctioning:' : `${auctioneer?.name ?? '?'} is auctioning:`;
    const auctHdr = this.add.text(px + 16, cy, auctioneerLabel, {
      ...ts(13, C.textMid), resolution: 2,
    });
    this.auctionContainer.add(auctHdr);
    cy += 24;

    const OFFER_W = pw - 32;
    const OFFER_H = 96;
    const offerCard = drawGoatCard(this, px + 16, cy, auction.goatOnOffer.type, {
      label: auction.goatOnOffer.type,
      sublabel: this.myValueSheet
        ? `Worth ${this.myValueSheet[auction.goatOnOffer.type]} pts to you`
        : undefined,
      width: OFFER_W,
      height: OFFER_H,
    });
    this.auctionContainer.add(offerCard);
    cy += OFFER_H + 16;

    // ── Held bid ──
    if (auction.heldBid) {
      const held = auction.heldBid;
      const heldBidder = state.players.find((p) => p.id === held.bidderId);
      const heldDesc = this.bidDescription(held.bid);

      const heldGfx = this.add.graphics();
      heldGfx.fillStyle(0x22aa55, 0.12);
      heldGfx.fillRoundedRect(px + 12, cy, pw - 24, 40, 6);
      heldGfx.lineStyle(2, 0x22aa55, 0.7);
      heldGfx.strokeRoundedRect(px + 12, cy, pw - 24, 40, 6);
      this.auctionContainer.add(heldGfx);

      const heldTxt = this.add.text(px + 22, cy + 12, `★  ${heldBidder?.name}: ${heldDesc}`, {
        ...ts(13, '#117733', 'bold'), resolution: 2,
      });
      const heldBadge = this.add.text(px + pw - 30, cy + 12, 'HELD', {
        ...ts(10, '#ffffff', 'bold'), backgroundColor: '#22aa55',
        padding: { left: 5, right: 5, top: 2, bottom: 2 }, resolution: 2,
      }).setOrigin(1, 0);
      this.auctionContainer.add([heldTxt, heldBadge]);

      if (amAuctioneer) {
        const acceptBtn = makeBtn(
          this, px + pw - 108, cy + 6, 'Accept',
          C.greenAction,
          () => {
            playAuctionAccepted();
            this.room.send('AcceptBid', { bidderId: held.bidderId });
          },
          { w: 80, h: 26 }
        );
        this.auctionContainer.add(acceptBtn);
      }

      cy += 50;
    }

    // ── Open bids ──
    const bidsHdr = this.add.text(px + 16, cy, 'Open Bids', {
      ...ts(13, C.textDark, 'bold'), resolution: 2,
    });
    this.auctionContainer.add(bidsHdr);
    cy += 24;

    if (auction.bids.length === 0) {
      const noBids = this.add.text(px + 16, cy, 'No bids yet…', {
        ...ts(12, C.textMid), fontStyle: 'italic', resolution: 2,
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.auctionContainer.add(noBids);
      cy += 26;
    } else {
      for (const entry of auction.bids) {
        const bidder = state.players.find((p) => p.id === entry.bidderId);
        const desc = this.bidDescription(entry.bid);
        const isMyBid = entry.bidderId === this.myPlayerId;

        // Row background
        const rowGfx = this.add.graphics();
        rowGfx.fillStyle(isMyBid ? 0xf0e8c8 : C.parchment, 1);
        rowGfx.fillRoundedRect(px + 12, cy, pw - 24, 32, 5);
        rowGfx.lineStyle(1, C.parchmentDark, 1);
        rowGfx.strokeRoundedRect(px + 12, cy, pw - 24, 32, 5);
        this.auctionContainer.add(rowGfx);

        const bidTxt = this.add.text(px + 22, cy + 8, `${bidder?.name}: ${desc}`, {
          ...ts(12, C.textDark), resolution: 2,
        });
        this.auctionContainer.add(bidTxt);

        let btnX = px + pw - 26;

        if (amAuctioneer) {
          const rejectBtn = makeBtn(
            this, btnX - 64, cy + 2, 'Reject',
            C.redAction,
            () => {
              playBidRejected();
              this.room.send('RejectBid', { bidderId: entry.bidderId });
            },
            { w: 60, h: 26 }
          );
          const holdBtn = makeBtn(
            this, btnX - 132, cy + 2, 'Hold',
            C.amberAction,
            () => this.room.send('HoldBid', { bidderId: entry.bidderId }),
            { w: 60, h: 26 }
          );
          const acceptBtn = makeBtn(
            this, btnX - 202, cy + 2, 'Accept',
            C.greenAction,
            () => {
              playAuctionAccepted();
              this.room.send('AcceptBid', { bidderId: entry.bidderId });
            },
            { w: 64, h: 26 }
          );
          this.auctionContainer.add([acceptBtn, holdBtn, rejectBtn]);
        }

        cy += 40;

        // Retract / lock countdown for own bids
        if (isMyBid) {
          const placedAt = entry.bidPlacedAt ?? 0;
          const lockMsLeft = placedAt + BID_LOCK_SECONDS * 1000 - Date.now();
          if (lockMsLeft > 0) {
            const cntTxt = this.add.text(px + 22, cy, `Can retract in ${Math.ceil(lockMsLeft / 1000)}s`, {
              ...ts(11, C.textMid), fontStyle: 'italic', resolution: 2,
            } as Phaser.Types.GameObjects.Text.TextStyle);
            this.auctionContainer.add(cntTxt);
            this.lockCountdownText = cntTxt;
            if (this.bidLockTimeout === null) {
              this.bidLockTimeout = setTimeout(() => {
                this.bidLockTimeout = null;
                this.updateUI();
              }, lockMsLeft + 50);
            }
          } else {
            const retractBtn = makeBtn(
              this, px + 22, cy, 'Retract bid',
              C.greyAction,
              () => this.room.send('RetractBid', {}),
              { w: 100, h: 24 }
            );
            this.auctionContainer.add(retractBtn);
          }
          cy += 32;
        }
      }
    }

    // ── Bid composer (non-auctioneer) ──
    if (!amAuctioneer && myPlayer) {
      cy += 8;
      // Divider
      const divGfx = this.add.graphics();
      divGfx.lineStyle(1, C.parchmentDark, 1);
      divGfx.lineBetween(px + 16, cy, px + pw - 16, cy);
      this.auctionContainer.add(divGfx);
      cy += 12;

      const composerLbl = this.add.text(px + 16, cy, 'Place your bid:', {
        ...ts(13, C.textDark, 'bold'), resolution: 2,
      });
      this.auctionContainer.add(composerLbl);
      cy += 26;

      // Goat selector DOM overlay
      this.updateGoatSelectorOverlay(myPlayer, cy);
      cy += myPlayer.hand.length * 34 + 8;

      // Cash label
      const cashLbl = this.add.text(px + 16, cy, 'Cash offer:', {
        ...ts(12, C.textMid), resolution: 2,
      });
      this.auctionContainer.add(cashLbl);
      cy += 26;

      // Cash input DOM overlay
      if (!this.bidInputOverlay) {
        this.bidInputOverlay = document.createElement('input');
        this.bidInputOverlay.type = 'text';
        this.bidInputOverlay.inputMode = 'numeric';
        this.bidInputOverlay.placeholder = '0';
        Object.assign(this.bidInputOverlay.style, {
          position: 'absolute',
          width: '110px',
          padding: '7px 10px',
          fontSize: '15px',
          fontFamily: "'Nunito', Arial, sans-serif",
          fontWeight: '700',
          border: '2px solid #c89b2a',
          borderRadius: '8px',
          background: '#fffdf5',
          color: '#2d1b0e',
          outline: 'none',
        });
        document.body.appendChild(this.bidInputOverlay);
      }

      const canvasRect = this.game.canvas.getBoundingClientRect();
      const scaleX = canvasRect.width / W;
      const scaleY = canvasRect.height / H;
      this.bidInputOverlay.style.left = (canvasRect.left + (CENTER_X + 16) * scaleX) + 'px';
      this.bidInputOverlay.style.top  = (canvasRect.top  + cy * scaleY) + 'px';
      this.bidInputOverlay.style.width = (110 * scaleX) + 'px';
      this.bidInputOverlay.style.display = 'block';

      cy += 46;

      const bidBtn = makeBtn(
        this, px + 16, cy, 'Place Bid', C.greenAction,
        () => {
          const amount = parseInt(this.bidInputOverlay?.value || '0', 10);
          const selectedGoats = (myPlayer?.hand ?? []).filter((g) =>
            this.selectedBidGoatIds.has(g.id)
          );
          const bid: Bid = { cash: isNaN(amount) ? 0 : amount, goats: selectedGoats };
          this.room.send('PlaceBid', { bid });
          playBidPlaced();
          if (this.bidInputOverlay) this.bidInputOverlay.value = '';
          this.selectedBidGoatIds.clear();
          this.updateUI();
        },
        { w: 110, h: 36 }
      );
      this.auctionContainer.add(bidBtn);
    } else {
      this.hideBidComposerOverlays();
    }
  }

  // ── Right: Other players + value sheet ────────────────────────────────
  private buildRightPanel(state: GameState, myPlayer: PlayerState | undefined) {
    this.rightContainer.removeAll(true);

    const px = W - RIGHT_W + 8, py = CONTENT_Y, pw = RIGHT_W - 16, ph = CONTENT_H;
    const OTHERS_H = Math.min(280, (state.players.length - 1) * 70 + 46);
    const VS_H = ph - OTHERS_H - 12;

    // ── Other players panel ──
    const ogfx = this.add.graphics();
    drawPanel(ogfx, px, py, pw, OTHERS_H, { headerH: 36, headerColor: C.woodDark });
    const oLbl = this.add.text(px + pw / 2, py + 18, 'PLAYERS', {
      ...ts(11, C.textLight, 'bold'), resolution: 2,
    }).setOrigin(0.5);
    this.rightContainer.add([ogfx, oLbl]);

    let oy = py + 44;
    const auctioneerIdx = state.currentAuctioneerIndex;

    for (const player of state.players) {
      if (player.id === this.myPlayerId) continue;

      const isAuctioneer = state.players[auctioneerIdx]?.id === player.id;
      const nameColor = isAuctioneer ? '#c89b2a' : C.textDark;

      const nameTxt = this.add.text(px + 12, oy, player.name + (isAuctioneer ? ' 🔨' : ''), {
        ...ts(13, nameColor, 'bold'), resolution: 2,
      });
      const statsTxt = this.add.text(px + 12, oy + 18, `🐐 ${player.hand.length}   💰 ${player.cash}`, {
        ...ts(11, C.textMid), resolution: 2,
      });
      this.rightContainer.add([nameTxt, statsTxt]);

      // Separator
      const sepGfx = this.add.graphics();
      sepGfx.lineStyle(1, C.parchmentDark, 0.8);
      sepGfx.lineBetween(px + 10, oy + 40, px + pw - 10, oy + 40);
      this.rightContainer.add(sepGfx);

      oy += 54;
    }

    // ── Value sheet panel ──
    if (this.myValueSheet && VS_H > 80) {
      const vpy = py + OTHERS_H + 12;
      const vgfx = this.add.graphics();
      drawPanel(vgfx, px, vpy, pw, VS_H, { headerH: 36, headerColor: C.woodDark });
      const vLbl = this.add.text(px + pw / 2, vpy + 18, 'YOUR VALUES', {
        ...ts(11, C.textLight, 'bold'), resolution: 2,
      }).setOrigin(0.5);
      this.rightContainer.add([vgfx, vLbl]);

      const sheet = this.myValueSheet;
      const sortedTypes = (Object.keys(sheet) as GoatType[]).sort((a, b) => sheet[b] - sheet[a]);

      const cardW = (pw - 24) / 2 - 4;
      const cardH = (VS_H - 50) / Math.ceil(sortedTypes.length / 2) - 6;
      let row = 0, col = 0;

      sortedTypes.forEach((type) => {
        const val = sheet[type];
        const cx2 = px + 12 + col * (cardW + 8);
        const cy2 = vpy + 42 + row * (cardH + 6);

        const vCardGfx = this.add.graphics();
        vCardGfx.fillStyle(GOAT_COLOR[type], 0.15);
        vCardGfx.fillRoundedRect(cx2, cy2, cardW, cardH, 6);
        vCardGfx.lineStyle(2, GOAT_COLOR[type], 0.6);
        vCardGfx.strokeRoundedRect(cx2, cy2, cardW, cardH, 6);

        const typeTxt = this.add.text(cx2 + cardW / 2, cy2 + cardH / 2 - 8, type, {
          ...ts(11, GOAT_COLOR_CSS[type], 'bold'), resolution: 2,
        }).setOrigin(0.5);
        const valTxt = this.add.text(cx2 + cardW / 2, cy2 + cardH / 2 + 8, `${val} pts`, {
          ...ts(13, C.textDark, 'bold'), resolution: 2,
        }).setOrigin(0.5);

        this.rightContainer.add([vCardGfx, typeTxt, valTxt]);

        col++;
        if (col >= 2) { col = 0; row++; }
      });
    }
  }

  // ── Bid description ────────────────────────────────────────────────────
  private bidDescription(bid: Bid): string {
    if (bid.goats.length === 0) return `💰 ${bid.cash}`;
    const goatList = bid.goats.map((g) => g.type).join(', ');
    return `💰 ${bid.cash}  +  🐐 [${goatList}]`;
  }

  // ── Goat selector DOM overlay ─────────────────────────────────────────
  private updateGoatSelectorOverlay(myPlayer: PlayerState, panelY: number) {
    if (this.goatSelectorOverlay) {
      this.goatSelectorOverlay.remove();
      this.goatSelectorOverlay = null;
    }
    if (myPlayer.hand.length === 0) return;

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / W;
    const scaleY = canvasRect.height / H;

    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'absolute',
      left:  (canvasRect.left + (CENTER_X + 16) * scaleX) + 'px',
      top:   (canvasRect.top  + panelY * scaleY) + 'px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    });

    const lbl = document.createElement('div');
    lbl.textContent = 'Include goats:';
    Object.assign(lbl.style, {
      fontSize: (12 * Math.min(scaleX, scaleY)) + 'px',
      color: '#6b4226',
      fontFamily: "'Nunito', Arial, sans-serif",
      fontWeight: '700',
      marginBottom: '2px',
    });
    wrap.appendChild(lbl);

    for (const goat of myPlayer.hand) {
      const isSelected = this.selectedBidGoatIds.has(goat.id);
      const accentHex = GOAT_COLOR_CSS[goat.type];
      const btn = document.createElement('button');
      const goatVal = this.myValueSheet ? this.myValueSheet[goat.type] : null;
      btn.textContent = goatVal !== null ? `${goat.type}  (${goatVal} pts)` : goat.type;
      Object.assign(btn.style, {
        padding: `3px ${8 * Math.min(scaleX, scaleY)}px`,
        fontSize: (11 * Math.min(scaleX, scaleY)) + 'px',
        fontFamily: "'Nunito', Arial, sans-serif",
        fontWeight: '700',
        cursor: 'pointer',
        border: `2px solid ${accentHex}`,
        borderRadius: '6px',
        background: isSelected ? accentHex : '#fffdf5',
        color: isSelected ? '#fff' : '#2d1b0e',
        transition: 'background 0.15s',
        width: (160 * scaleX) + 'px',
        textAlign: 'left',
      });
      btn.addEventListener('click', () => {
        if (this.selectedBidGoatIds.has(goat.id)) {
          this.selectedBidGoatIds.delete(goat.id);
          btn.style.background = '#fffdf5';
          btn.style.color = '#2d1b0e';
        } else {
          this.selectedBidGoatIds.add(goat.id);
          btn.style.background = accentHex;
          btn.style.color = '#fff';
        }
      });
      wrap.appendChild(btn);
    }

    document.body.appendChild(wrap);
    this.goatSelectorOverlay = wrap;
  }

  private hideBidComposerOverlays() {
    if (this.bidInputOverlay) this.bidInputOverlay.style.display = 'none';
    if (this.goatSelectorOverlay) {
      this.goatSelectorOverlay.remove();
      this.goatSelectorOverlay = null;
    }
  }

  private cleanupDomOverlays() {
    this.bidInputOverlay?.remove();
    this.bidInputOverlay = null;
    this.goatSelectorOverlay?.remove();
    this.goatSelectorOverlay = null;
  }
}
