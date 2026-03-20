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
  private playerCircleContainer!: Phaser.GameObjects.Container;

  // Stores center position of each player node (playerId → canvas coords)
  // Used by Task 9 for goods-transfer tween source/destination
  public playerNodePositions: Map<string, { x: number; y: number }> = new Map();

  // DOM overlays for bid composition
  private goatSelectorOverlay: HTMLDivElement | null = null;

  // Bid draft state — reset when a new auction opens
  private bidDraft: number = 0;
  private lastAuctionGoatId: string | null = null;
  private selectedBidGoatIds: Set<string> = new Set();

  // Bid animation tracking — detects state transitions for row-level effects
  private recentlyHeldBidderId: string | null = null;
  private recentlyRejectedBidderIds: Set<string> = new Set();
  private prevOpenBidderIds: Set<string> = new Set();
  private prevHeldBidderId: string | null = null;
  private lockCountdownText: Phaser.GameObjects.Text | null = null;
  private bidLockTimeout: ReturnType<typeof setTimeout> | null = null;

  // Flash overlay for visual feedback
  private flashRect!: Phaser.GameObjects.Rectangle;

  // Auction result announcement overlay (Task 9)
  private announcementContainer: Phaser.GameObjects.Container | null = null;

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
      const newAuctionGoatId = newState.auction?.goatOnOffer.id ?? null;
      if (newAuctionGoatId !== this.lastAuctionGoatId) {
        this.bidDraft = 0;
        this.selectedBidGoatIds.clear();
        this.lastAuctionGoatId = newAuctionGoatId;
        // Reset bid tracking for new auction
        this.prevOpenBidderIds.clear();
        this.prevHeldBidderId = null;
      }

      // Detect bid state transitions for row-level animations
      const oldAuction = this.gameState?.auction;
      const newAuction = newState.auction;
      if (oldAuction && newAuction && oldAuction.goatOnOffer.id === newAuction.goatOnOffer.id) {
        const newOpenIds = new Set(newAuction.bids.map((b) => b.bidderId));
        const newHeldId = newAuction.heldBid?.bidderId ?? null;

        // Open → held: amber highlight the held bid row
        if (newHeldId && newHeldId !== this.prevHeldBidderId && this.prevOpenBidderIds.has(newHeldId)) {
          this.recentlyHeldBidderId = newHeldId;
        }

        // Open → gone (not held): mark as rejected for animation
        for (const bidderId of this.prevOpenBidderIds) {
          if (!newOpenIds.has(bidderId) && bidderId !== newHeldId) {
            this.recentlyRejectedBidderIds.add(bidderId);
          }
        }

        this.prevOpenBidderIds = newOpenIds;
        this.prevHeldBidderId = newHeldId;
      }

      // Detect auction end for winner announcement (Task 9)
      if (oldAuction && !newAuction && newState.phase === 'playing') {
        const goat = oldAuction.goatOnOffer;
        const sellerPlayerId = oldAuction.auctioneerPlayerId;
        const oldSeller = this.gameState?.players.find((p) => p.id === sellerPlayerId);
        const newSeller = newState.players.find((p) => p.id === sellerPlayerId);

        // If seller no longer has the goat, a sale occurred
        const sellerLostGoat = oldSeller?.hand.some((g) => g.id === goat.id) &&
          !newSeller?.hand.some((g) => g.id === goat.id);

        if (sellerLostGoat) {
          // Find the buyer (who gained the goat)
          let buyerPlayerId: string | null = null;
          let pricePaid = 0;
          for (const newPlayer of newState.players) {
            if (newPlayer.id === sellerPlayerId) continue;
            if (newPlayer.hand.some((g) => g.id === goat.id)) {
              buyerPlayerId = newPlayer.id;
              const oldBuyer = this.gameState?.players.find((p) => p.id === newPlayer.id);
              pricePaid = (oldBuyer?.cash ?? 0) - newPlayer.cash;
              break;
            }
          }
          if (buyerPlayerId) {
            this.showAuctionResult('sale', sellerPlayerId, buyerPlayerId, goat.type, pricePaid, newState);
          }
        } else {
          // No sale
          this.showAuctionResult('nosale', sellerPlayerId, null, goat.type, 0, newState);
        }
      }

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
        finalPlayers: data.finalPlayers ?? [],
        myPlayerId: this.myPlayerId,
      });
    });

    this.createStaticUI();
    this.updateUI();

    // Debug handle — lets preview_eval drive the game without needing real pointer events
    (window as any).__game = {
      startGame:        () => this.room.send('StartGame', {}),
      putUpForAuction:  (goatId: string) => this.room.send('PutUpForAuction', { goatId }),
      placeBid:         (bid: { cash: number; goats: { id: string; type: string }[] }) =>
        this.room.send('PlaceBid', { bid }),
      acceptBid:        (bidderId: string) => this.room.send('AcceptBid', { bidderId }),
      holdBid:          (bidderId: string) => this.room.send('HoldBid', { bidderId }),
      rejectBid:        (bidderId: string) => this.room.send('RejectBid', { bidderId }),
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
        this.lockCountdownText.setText(`${lockedFor}s`);
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
    this.handContainer         = this.add.container(0, 0);
    this.auctionContainer      = this.add.container(0, 0);
    this.rightContainer        = this.add.container(0, 0);
    this.playerCircleContainer = this.add.container(0, 0);

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

  // ── Auction result announcement (Task 9) ──────────────────────────────
  private showAuctionResult(
    type: 'sale' | 'nosale',
    sellerPlayerId: string,
    buyerPlayerId: string | null,
    goatType: GoatType,
    price: number,
    state: GameState,
  ) {
    // Remove any existing announcement
    if (this.announcementContainer) {
      this.announcementContainer.destroy();
      this.announcementContainer = null;
    }

    const sellerName = state.players.find((p) => p.id === sellerPlayerId)?.name ?? '?';
    const buyerName = buyerPlayerId
      ? (state.players.find((p) => p.id === buyerPlayerId)?.name ?? '?')
      : null;

    const bannerText = type === 'sale'
      ? `${sellerName} sold a ${goatType} Goat\nto ${buyerName} for ${price} gold!`
      : 'No sale — goat kept!';

    const BW = 460, BH = type === 'sale' ? 80 : 52;
    const BX = W / 2, BY = H / 2 - 40;

    const gfx = this.add.graphics();
    gfx.fillStyle(C.woodDark, 0.92);
    gfx.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
    gfx.lineStyle(3, type === 'sale' ? C.gold : C.woodMid, 0.9);
    gfx.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);

    const txt = this.add.text(0, 0, bannerText, {
      ...ts(type === 'sale' ? 16 : 14, C.textLight, 'bold'),
      resolution: 2,
      align: 'center',
    }).setOrigin(0.5);

    const container = this.add.container(BX, BY, [gfx, txt]);
    container.setAlpha(0);
    this.announcementContainer = container;

    // Fade in, hold, fade out
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
              container.destroy();
              if (this.announcementContainer === container) {
                this.announcementContainer = null;
              }
            },
          });
        });
      },
    });

    // Goat token tween from seller to buyer (sale only)
    if (type === 'sale' && buyerPlayerId) {
      const sellerPos = this.playerNodePositions.get(sellerPlayerId);
      const buyerPos = this.playerNodePositions.get(buyerPlayerId);
      if (sellerPos && buyerPos) {
        const tokenGfx = this.add.graphics();
        const tokenColor = GOAT_COLOR[goatType];
        tokenGfx.fillStyle(tokenColor, 0.9);
        tokenGfx.fillRoundedRect(-18, -12, 36, 24, 6);
        tokenGfx.lineStyle(2, C.gold, 0.8);
        tokenGfx.strokeRoundedRect(-18, -12, 36, 24, 6);
        const tokenTxt = this.add.text(0, 0, '🐐', { fontSize: '14px', resolution: 2 }).setOrigin(0.5);

        const tokenContainer = this.add.container(sellerPos.x, sellerPos.y, [tokenGfx, tokenTxt]);

        this.tweens.add({
          targets: tokenContainer,
          x: buyerPos.x,
          y: buyerPos.y,
          duration: 800,
          delay: 300,
          ease: 'Power2.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: tokenContainer,
              alpha: 0,
              duration: 300,
              onComplete: () => tokenContainer.destroy(),
            });
          },
        });
      }
    }
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
      this.buildWaitingCenter(isMyTurn);
    }

    this.buildRightPanel(state, myPlayer);
    if (state.phase === 'playing') {
      this.buildPlayerCircle(state, myPlayer);
    } else {
      this.playerCircleContainer.removeAll(true);
    }
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

    const showGlow = isMyTurn && !this.gameState?.auction;

    for (const goat of myPlayer.hand) {
      const sublabel = this.myValueSheet
        ? `${this.myValueSheet[goat.type]} pts`
        : undefined;

      if (showGlow) {
        // Gold glow ring behind the card to indicate clickability
        const glowGfx = this.add.graphics();
        glowGfx.lineStyle(3, C.gold, 0.9);
        glowGfx.strokeRoundedRect(panelX + 8, cy - 2, CARD_W + 4, CARD_H + 4, 10);
        this.handContainer.add(glowGfx);
        this.tweens.add({
          targets: glowGfx,
          alpha: { from: 0.4, to: 1.0 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

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
  private buildWaitingCenter(isMyTurn: boolean = false) {
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
    this.auctionContainer.add(lbl);

    if (isMyTurn) {
      // Gold "Your Turn!" banner with pulse tween
      const bannerGfx = this.add.graphics();
      bannerGfx.fillStyle(C.gold, 0.2);
      bannerGfx.fillRoundedRect(px + 32, py + ph / 2 - 80, pw - 64, 100, 12);
      bannerGfx.lineStyle(3, C.gold, 0.8);
      bannerGfx.strokeRoundedRect(px + 32, py + ph / 2 - 80, pw - 64, 100, 12);
      this.auctionContainer.add(bannerGfx);

      const yourTurnTxt = this.add.text(px + pw / 2, py + ph / 2 - 42, 'Your Turn!', {
        ...ts(28, '#c89b2a', 'bold'), resolution: 2,
      }).setOrigin(0.5);
      this.auctionContainer.add(yourTurnTxt);

      const subTxt = this.add.text(
        px + pw / 2, py + ph / 2 + 2,
        'Select a goat from your hand\nto start the auction',
        { ...ts(13, C.textMid), resolution: 2, align: 'center' }
      ).setOrigin(0.5);
      this.auctionContainer.add(subTxt);

      // Gentle alpha pulse on the banner graphic
      this.tweens.add({
        targets: bannerGfx,
        alpha: { from: 0.6, to: 1.0 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const msg = this.add.text(px + pw / 2, py + ph / 2, 'Waiting for next auction…', {
        ...ts(15, C.textMid), resolution: 2,
      }).setOrigin(0.5);
      this.auctionContainer.add(msg);
    }
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

    // ── Held bid (prominent center display) ──
    if (auction.heldBid) {
      const held = auction.heldBid;
      const heldBidder = state.players.find((p) => p.id === held.bidderId);
      const heldDesc = this.bidDescription(held.bid);
      const isNewlyHeld = this.recentlyHeldBidderId === held.bidderId;
      const HELD_H = 66;

      const heldGfx = this.add.graphics();
      heldGfx.fillStyle(isNewlyHeld ? 0xcc8800 : 0x1a7a40, isNewlyHeld ? 0.2 : 0.13);
      heldGfx.fillRoundedRect(px + 12, cy, pw - 24, HELD_H, 8);
      heldGfx.lineStyle(2.5, isNewlyHeld ? 0xcc8800 : 0x22aa55, 0.9);
      heldGfx.strokeRoundedRect(px + 12, cy, pw - 24, HELD_H, 8);
      this.auctionContainer.add(heldGfx);

      if (isNewlyHeld) {
        this.tweens.add({
          targets: heldGfx,
          alpha: { from: 1, to: 0.5 },
          duration: 350,
          yoyo: true,
          repeat: 1,
          ease: 'Power2',
          onComplete: () => { this.recentlyHeldBidderId = null; },
        });
      }

      // "HELD BID" title row
      this.auctionContainer.add(this.add.text(px + 22, cy + 8, '⏸  HELD BID', {
        ...ts(10, isNewlyHeld ? '#cc8800' : '#117733', 'bold'), resolution: 2,
      }));

      // Bidder name + amount
      this.auctionContainer.add(this.add.text(px + 22, cy + 28, `from ${heldBidder?.name ?? '?'}:  ${heldDesc}`, {
        ...ts(14, isNewlyHeld ? '#995500' : '#1a5a30', 'bold'), resolution: 2,
      }));

      if (amAuctioneer) {
        const acceptBtn = makeBtn(
          this, px + pw - 104, cy + 20, 'Accept',
          C.greenAction,
          () => {
            playAuctionAccepted();
            this.room.send('AcceptBid', { bidderId: held.bidderId });
          },
          { w: 80, h: 28 }
        );
        this.auctionContainer.add(acceptBtn);
      }

      cy += HELD_H + 10;
    }

    // ── Bid composer (non-auctioneer) ──
    if (!amAuctioneer && myPlayer) {
      // Start right after goat card / held bid — no artificial gap to the bottom
      const CX = px + pw / 2;  // horizontal center of the auction panel
      cy += 8;

      // Divider
      const divGfx = this.add.graphics();
      divGfx.lineStyle(1, C.parchmentDark, 1);
      divGfx.lineBetween(px + 16, cy, px + pw - 16, cy);
      this.auctionContainer.add(divGfx);
      cy += 12;

      const composerLbl = this.add.text(CX, cy, 'Place your bid:', {
        ...ts(13, C.textDark, 'bold'), resolution: 2,
      }).setOrigin(0.5, 0);
      this.auctionContainer.add(composerLbl);
      cy += 26;

      // Goat selector DOM overlay — centered in panel
      this.updateGoatSelectorOverlay(myPlayer, cy, CX);
      cy += myPlayer.hand.length * 34 + 8;

      // Compute current highest bid for display and validation
      const allBidsForComposer = [
        ...auction.bids,
        ...(auction.heldBid ? [auction.heldBid] : []),
      ];
      const currentHighCash = allBidsForComposer.reduce((max, b) => Math.max(max, b.bid.cash), 0);
      const highEntry = allBidsForComposer.reduce<typeof allBidsForComposer[0] | null>(
        (best, b) => (!best || b.bid.cash > best.bid.cash) ? b : best, null
      );
      const highBidderName = highEntry
        ? (state.players.find((p) => p.id === highEntry.bidderId)?.name ?? '?')
        : null;

      // Draft amount display — centered
      const draftDisplay = this.add.text(
        CX, cy,
        `Your bid: ${this.bidDraft} gold`,
        { ...ts(14, C.textDark, 'bold'), resolution: 2 }
      ).setOrigin(0.5, 0);
      this.auctionContainer.add(draftDisplay);
      cy += 24;

      // Current high bid info line — centered
      const highInfoText = highBidderName
        ? `Current high: ${currentHighCash} (${highBidderName})`
        : 'No bids yet';
      const highDisplay = this.add.text(CX, cy, highInfoText, {
        ...ts(11, C.textMid), resolution: 2,
      }).setOrigin(0.5, 0);
      this.auctionContainer.add(highDisplay);
      cy += 22;

      // Increment / utility buttons row: +1  +5  Raise  ✕Clear — centered as a group
      const btnH = 30;
      const canAdd1 = this.bidDraft + 1 <= (myPlayer?.cash ?? 0);
      const canAdd5 = this.bidDraft + 5 <= (myPlayer?.cash ?? 0);
      // Total width: 44+8+44+8+56=160 without Clear; +8+30=198 with Clear
      const totalBtnW = this.bidDraft > 0 ? 198 : 160;
      const btnStartX = CX - totalBtnW / 2;

      const add1Btn = makeBtn(this, btnStartX, cy, '+1', canAdd1 ? C.greyAction : 0x999999, () => {
        if (canAdd1) { this.bidDraft += 1; this.updateUI(); }
      }, { w: 44, h: btnH });
      if (!canAdd1) add1Btn.setAlpha(0.45);
      this.auctionContainer.add(add1Btn);

      const add5Btn = makeBtn(this, btnStartX + 52, cy, '+5', canAdd5 ? C.greyAction : 0x999999, () => {
        if (canAdd5) { this.bidDraft += 5; this.updateUI(); }
      }, { w: 44, h: btnH });
      if (!canAdd5) add5Btn.setAlpha(0.45);
      this.auctionContainer.add(add5Btn);

      const raiseAmt = Math.min(currentHighCash + 1, myPlayer?.cash ?? 0);
      const raiseBtn = makeBtn(this, btnStartX + 104, cy, 'Raise', C.amberAction, () => {
        this.bidDraft = raiseAmt;
        this.updateUI();
      }, { w: 56, h: btnH });
      this.auctionContainer.add(raiseBtn);

      if (this.bidDraft > 0) {
        const clearBtn = makeBtn(this, btnStartX + 168, cy, '✕', C.redAction, () => {
          this.bidDraft = 0;
          this.updateUI();
        }, { w: 30, h: btnH });
        this.auctionContainer.add(clearBtn);
      }

      cy += btnH + 8;

      // Bid (submit) button — full width, centered with equal margins
      const cashBalance = myPlayer?.cash ?? 0;
      const bidValid = this.bidDraft > currentHighCash && this.bidDraft <= cashBalance;
      if (bidValid) {
        const bidBtn = makeBtn(
          this, px + 16, cy, `Bid ${this.bidDraft} gold`, C.greenAction,
          () => {
            const selectedGoats = (myPlayer?.hand ?? []).filter((g) =>
              this.selectedBidGoatIds.has(g.id)
            );
            const bid: Bid = { cash: this.bidDraft, goats: selectedGoats };
            this.room.send('PlaceBid', { bid });
            playBidPlaced();
            this.bidDraft = 0;
            this.selectedBidGoatIds.clear();
            this.updateUI();
          },
          { w: pw - 32, h: 36 }
        );
        this.auctionContainer.add(bidBtn);
      } else {
        const disabledGfx = this.add.graphics();
        disabledGfx.fillStyle(C.greyAction, 0.35);
        disabledGfx.fillRoundedRect(px + 16, cy, pw - 32, 36, 6);
        const hint = this.bidDraft === 0
          ? 'Use buttons above to set a bid'
          : this.bidDraft > cashBalance
            ? 'Not enough gold'
            : 'Must beat current high bid';
        const disabledTxt = this.add.text(
          CX, cy + 18, hint,
          { ...ts(11, '#888888'), resolution: 2 }
        ).setOrigin(0.5);
        this.auctionContainer.add([disabledGfx, disabledTxt]);
      }
      cy += 40;
    } else {
      this.hideBidComposerOverlays();
    }
  }

  // ── Right: Value sheet ────────────────────────────────────────────────
  // Note: PLAYERS list has been replaced by the player circle overlay.
  private buildRightPanel(state: GameState, myPlayer: PlayerState | undefined) {
    this.rightContainer.removeAll(true);

    const px = W - RIGHT_W + 8, py = CONTENT_Y, pw = RIGHT_W - 16, ph = CONTENT_H;
    const VS_H = ph;

    // ── Value sheet panel ──
    if (this.myValueSheet && VS_H > 80) {
      const vpy = py;
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

  // ── Player circle overlay ─────────────────────────────────────────────
  private buildPlayerCircle(state: GameState, myPlayer: PlayerState | undefined) {
    this.playerCircleContainer.removeAll(true);
    this.playerNodePositions.clear();

    const players = state.players;
    const n = players.length;
    if (n === 0) return;

    const myIdx = players.findIndex((p) => p.id === this.myPlayerId);
    const auctioneerPlayerId = state.players[state.currentAuctioneerIndex]?.id;

    // Ellipse geometry: center + radii
    const CX = LEFT_W + CENTER_W / 2;  // horizontal center of canvas (≈ 638)
    const CY = CONTENT_Y + CONTENT_H * 0.5; // vertical midpoint of content area
    const RX = 350; // horizontal radius
    const RY = 220; // vertical radius

    const NODE_W = 96;
    const NODE_H = 44;
    const HALF_W = NODE_W / 2;
    const HALF_H = NODE_H / 2;

    for (let seat = 0; seat < n; seat++) {
      const playerIdx = (myIdx + seat) % n;
      const player = players[playerIdx];
      const isMe = player.id === this.myPlayerId;
      const isAuctioneer = player.id === auctioneerPlayerId;

      // Screen clockwise from bottom: decreasing math angle
      const screenAngle = Math.PI / 2 - seat * (2 * Math.PI / n);
      const nx = Math.round(CX + RX * Math.cos(screenAngle));
      const ny = Math.round(CY + RY * Math.sin(screenAngle));

      this.playerNodePositions.set(player.id, { x: nx, y: ny });

      // Draw node
      const gfx = this.add.graphics();

      // Auctioneer: gold glow ring; me: green border; others: parchment
      if (isAuctioneer) {
        gfx.fillStyle(C.gold, 0.25);
        gfx.fillRoundedRect(-HALF_W - 3, -HALF_H - 3, NODE_W + 6, NODE_H + 6, 10);
        gfx.lineStyle(2.5, C.gold, 1);
        gfx.strokeRoundedRect(-HALF_W - 3, -HALF_H - 3, NODE_W + 6, NODE_H + 6, 10);
      }

      // Node background
      const bgColor = isMe ? 0x1a5a30 : (isAuctioneer ? 0x2e1a00 : C.woodDark);
      gfx.fillStyle(bgColor, 0.92);
      gfx.fillRoundedRect(-HALF_W, -HALF_H, NODE_W, NODE_H, 8);
      gfx.lineStyle(1.5, isMe ? 0x22bb55 : (isAuctioneer ? C.gold : C.woodMid), 0.9);
      gfx.strokeRoundedRect(-HALF_W, -HALF_H, NODE_W, NODE_H, 8);

      // Name text
      const displayName = isMe ? 'You' : player.name;
      const nameTxt = this.add.text(0, -8, displayName, {
        ...ts(10, C.textLight, 'bold'), resolution: 2,
      }).setOrigin(0.5);

      // Stats text
      const statsTxt = this.add.text(0, 7, `🐐${player.hand.length}  💰${player.cash}`, {
        ...ts(10, C.textLight), resolution: 2,
      }).setOrigin(0.5);

      // Auctioneer hammer badge
      const nodeItems: Phaser.GameObjects.GameObject[] = [gfx, nameTxt, statsTxt];
      if (isAuctioneer) {
        const hammerTxt = this.add.text(HALF_W - 2, -HALF_H + 2, '🔨', {
          fontSize: '10px', resolution: 2,
        }).setOrigin(1, 0);
        nodeItems.push(hammerTxt);
      }

      // My own bid badge + retract below my node
      if (isMe && state.auction) {
        const myBid = state.auction.bids.find((b) => b.bidderId === player.id);
        if (myBid) {
          const BADGE_W = 112;
          const BADGE_H = 26;
          const badgeOffX = -BADGE_W / 2;
          const badgeOffY = HALF_H + 6;

          const badgeGfx = this.add.graphics();
          badgeGfx.fillStyle(0x1a4080, 0.9);
          badgeGfx.fillRoundedRect(badgeOffX, badgeOffY, BADGE_W, BADGE_H, 5);
          const bidText = myBid.bid.goats.length > 0
            ? `💰${myBid.bid.cash} +🐐${myBid.bid.goats.length}`
            : `💰 ${myBid.bid.cash} gold`;
          const badgeTxt = this.add.text(0, badgeOffY + BADGE_H / 2, bidText, {
            ...ts(10, '#ffffff', 'bold'), resolution: 2,
          }).setOrigin(0.5, 0.5);
          nodeItems.push(badgeGfx, badgeTxt);

          // Retract button or countdown below badge
          const placedAt = myBid.bidPlacedAt ?? 0;
          const lockMsLeft = placedAt + BID_LOCK_SECONDS * 1000 - Date.now();
          const retractY = badgeOffY + BADGE_H + 4;
          if (lockMsLeft > 0) {
            const cntTxt = this.add.text(0, retractY, `${Math.ceil(lockMsLeft / 1000)}s`, {
              ...ts(9, C.textMid), fontStyle: 'italic', resolution: 2,
            } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
            nodeItems.push(cntTxt);
            this.lockCountdownText = cntTxt;
            if (this.bidLockTimeout === null) {
              this.bidLockTimeout = setTimeout(() => {
                this.bidLockTimeout = null;
                this.updateUI();
              }, lockMsLeft + 50);
            }
          } else {
            const retractBtn = makeBtn(this, -50, retractY, 'Retract', C.greyAction,
              () => this.room.send('RetractBid', {}), { w: 100, h: 22 });
            nodeItems.push(retractBtn);
          }
        }
      }

      // Bid badge + auctioneer action buttons below node (not for own node)
      if (!isMe && state.auction) {
        const iAmAuctioneer = myPlayer?.id === state.auction.auctioneerPlayerId;
        const playerBid = state.auction.bids.find((b) => b.bidderId === player.id);
        const isHeldPlayer = state.auction.heldBid?.bidderId === player.id;
        const bidEntry = isHeldPlayer ? state.auction.heldBid! : (playerBid ?? null);

        if (bidEntry) {
          const BADGE_W = 112;
          const BADGE_H = 26;
          const badgeOffX = -BADGE_W / 2;
          const badgeOffY = HALF_H + 6;

          const badgeGfx = this.add.graphics();
          if (isHeldPlayer) {
            badgeGfx.fillStyle(0x22aa55, 0.9);
            badgeGfx.fillRoundedRect(badgeOffX, badgeOffY, BADGE_W, BADGE_H, 5);
          } else {
            badgeGfx.fillStyle(0xf7e8c8, 0.95);
            badgeGfx.fillRoundedRect(badgeOffX, badgeOffY, BADGE_W, BADGE_H, 5);
            badgeGfx.lineStyle(1.5, 0xe8d0a0, 1);
            badgeGfx.strokeRoundedRect(badgeOffX, badgeOffY, BADGE_W, BADGE_H, 5);
          }

          const bidText = bidEntry.bid.goats.length > 0
            ? `💰${bidEntry.bid.cash} +🐐${bidEntry.bid.goats.length}`
            : `💰 ${bidEntry.bid.cash} gold`;
          const badgeTxt = this.add.text(0, badgeOffY + BADGE_H / 2, bidText, {
            ...ts(10, isHeldPlayer ? '#ffffff' : C.textDark, 'bold'), resolution: 2,
          }).setOrigin(0.5, 0.5);

          nodeItems.push(badgeGfx, badgeTxt);

          // Accept / Hold / Reject buttons for open bids (auctioneer only)
          if (iAmAuctioneer && playerBid && !isHeldPlayer) {
            const btnY = badgeOffY + BADGE_H + 4;
            const BTN_W = 34;
            const BTN_H = 20;
            const BTN_GAP = 3;
            const startX = -(BTN_W * 3 + BTN_GAP * 2) / 2;

            const acceptBtn = makeBtn(this, startX, btnY, '✓', C.greenAction, () => {
              playAuctionAccepted();
              this.room.send('AcceptBid', { bidderId: playerBid.bidderId });
            }, { w: BTN_W, h: BTN_H });
            const holdBtn = makeBtn(this, startX + BTN_W + BTN_GAP, btnY, '⏸', C.amberAction, () => {
              this.room.send('HoldBid', { bidderId: playerBid.bidderId });
            }, { w: BTN_W, h: BTN_H });
            const rejectBtn = makeBtn(this, startX + (BTN_W + BTN_GAP) * 2, btnY, '✕', C.redAction, () => {
              playBidRejected();
              this.room.send('RejectBid', { bidderId: playerBid.bidderId });
            }, { w: BTN_W, h: BTN_H });

            nodeItems.push(acceptBtn, holdBtn, rejectBtn);
          }
        }
      }

      const nodeContainer = this.add.container(nx, ny, nodeItems);
      this.playerCircleContainer.add(nodeContainer);

      // Red flash overlay on node when bid was just rejected
      if (this.recentlyRejectedBidderIds.has(player.id)) {
        const flashGfx = this.add.graphics();
        flashGfx.fillStyle(0xcc2200, 0.5);
        flashGfx.fillRoundedRect(nx - HALF_W - 2, ny - HALF_H - 2, NODE_W + 4, NODE_H + 4, 10);
        this.playerCircleContainer.add(flashGfx);
        this.tweens.add({
          targets: flashGfx,
          alpha: { from: 1, to: 0 },
          duration: 500,
          ease: 'Power2',
          onComplete: () => {
            this.recentlyRejectedBidderIds.delete(player.id);
            flashGfx.destroy();
          },
        });
      }

      // Auctioneer glow pulse tween
      if (isAuctioneer) {
        const lastNode = this.playerCircleContainer.last as Phaser.GameObjects.Container;
        this.tweens.add({
          targets: lastNode,
          scaleX: { from: 1, to: 1.04 },
          scaleY: { from: 1, to: 1.04 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  // ── Bid description ────────────────────────────────────────────────────
  private bidDescription(bid: Bid): string {
    if (bid.goats.length === 0) return `💰 ${bid.cash}`;
    const goatList = bid.goats.map((g) => g.type).join(', ');
    return `💰 ${bid.cash}  +  🐐 [${goatList}]`;
  }

  // ── Goat selector DOM overlay ─────────────────────────────────────────
  private updateGoatSelectorOverlay(myPlayer: PlayerState, panelY: number, panelCenterX = CENTER_X + 16) {
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
      left:  (canvasRect.left + (panelCenterX - 80) * scaleX) + 'px',
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
    if (this.goatSelectorOverlay) {
      this.goatSelectorOverlay.remove();
      this.goatSelectorOverlay = null;
    }
  }

  private cleanupDomOverlays() {
    this.goatSelectorOverlay?.remove();
    this.goatSelectorOverlay = null;
  }
}
