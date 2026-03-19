import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { GameState, GoatType, Bid, ValueSheet, PlayerState } from 'shared/types';
import { BID_LOCK_SECONDS } from 'shared/constants';

const GOAT_COLORS: Record<GoatType, number> = {
  [GoatType.Silly]: 0xFFD700,
  [GoatType.Angry]: 0xFF4444,
  [GoatType.Happy]: 0x44FF44,
  [GoatType.Hungry]: 0x4444FF,
};

export class GameScene extends Phaser.Scene {
  private room!: Room<GameState>;
  private gameState: GameState | null = null;
  private myPlayerId: string = '';
  private myValueSheet: ValueSheet | null = null;

  // UI elements
  private infoText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private handContainer!: Phaser.GameObjects.Container;
  private auctionPanel!: Phaser.GameObjects.Container;
  private othersPanel!: Phaser.GameObjects.Container;
  private valueSheetText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;

  // Auction UI — DOM overlays
  private bidInputOverlay: HTMLInputElement | null = null;
  private goatSelectorOverlay: HTMLDivElement | null = null;

  // Tracks which goats the local player has selected for their next bid
  private selectedBidGoatIds: Set<string> = new Set();

  // Bid retraction lock: countdown text updated every frame, timeout to re-render when lock expires
  private lockCountdownText: Phaser.GameObjects.Text | null = null;
  private bidLockTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(room: Room<GameState>) {
    super('GameScene');
    this.room = room;
  }

  preload() {
    // No assets to preload for now
  }

  create() {
    // The player's own ID is the Colyseus sessionId — available immediately,
    // no need to wait for a 'yourPlayerId' message that would race Phaser init.
    this.myPlayerId = this.room.sessionId;

    // Listen for state updates
    this.room.onMessage('stateUpdate', (newState: GameState) => {
      this.gameState = newState;
      this.updateUI();
    });

    // Request the current state now that listeners are registered.
    // The server's initial stateUpdate sent during onJoin races Phaser init
    // and is typically lost, so we ask for it explicitly.
    this.room.send('RequestState', {});

    this.room.onMessage('yourValueSheet', (sheet: ValueSheet) => {
      this.myValueSheet = sheet;
      this.updateUI();
    });

    this.room.onMessage('gameOver', (data: any) => {
      this.cleanupDomOverlays();
      this.scene.start('ScoreScene', {
        scores: data.scores,
        valueSheets: data.valueSheets,
        myPlayerId: this.myPlayerId,
      });
    });

    // Create initial UI
    this.createUI();
    this.updateUI();
  }

  update() {
    // Auction timer countdown
    if (this.gameState?.auction?.timerEndsAt && this.timerText) {
      const secondsLeft = Math.max(
        0,
        Math.ceil((this.gameState.auction.timerEndsAt - Date.now()) / 1000)
      );
      this.timerText.setText(`⏱ ${secondsLeft}s`);
      this.timerText.setColor(secondsLeft <= 10 ? '#ff4444' : '#ffffff');
      this.timerText.setVisible(true);
    }

    // Bid retraction lock countdown — update text every frame
    if (this.lockCountdownText && this.lockCountdownText.active) {
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

  private createUI() {
    // Background
    this.add.rectangle(0, 0, 1200, 800, 0xf0f0f0).setOrigin(0);

    // Top bar with player info
    const topBarHeight = 80;
    this.add
      .rectangle(0, 0, 1200, topBarHeight, 0x333333)
      .setOrigin(0);

    this.infoText = this.add
      .text(20, 20, '', { fontSize: '16px', color: '#fff' })
      .setOrigin(0);

    this.turnText = this.add
      .text(1180, 20, '', { fontSize: '14px', color: '#fff' })
      .setOrigin(1, 0);

    // Timer display — top-right of screen, below turn text
    this.timerText = this.add
      .text(1180, 45, '', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(1, 0)
      .setVisible(false);

    // Left panel: Your hand
    this.handContainer = this.add.container(20, topBarHeight + 20);

    // Center panel: Auction
    this.auctionPanel = this.add.container(400, topBarHeight + 20);

    // Right panel: Other players
    this.othersPanel = this.add.container(900, topBarHeight + 20);

    // Bottom bar: Value sheet
    const bottomBarHeight = 80;
    this.add
      .rectangle(0, 800 - bottomBarHeight, 1200, bottomBarHeight, 0xe0e0e0)
      .setOrigin(0);

    this.valueSheetText = this.add
      .text(20, 800 - bottomBarHeight + 10, '', {
        fontSize: '14px',
        color: '#333',
      })
      .setOrigin(0);
  }

  private updateUI() {
    if (!this.gameState) return;

    const state = this.gameState;

    // Update top bar
    const myPlayer = state.players.find((p) => p.id === this.myPlayerId);
    if (myPlayer) {
      this.infoText.setText(
        `${myPlayer.name} | Cash: ${myPlayer.cash} | Goats: ${myPlayer.hand.length}`
      );
    }

    // Update turn indicator
    const auctioneerIdx = state.currentAuctioneerIndex;
    const auctioneerName = state.players[auctioneerIdx]?.name || 'Unknown';
    const isMyTurn = state.players[auctioneerIdx]?.id === this.myPlayerId;

    if (state.phase === 'lobby') {
      this.turnText.setText('Waiting to start...');
    } else if (state.phase === 'playing') {
      const turnStatus = isMyTurn
        ? 'Your turn to auction!'
        : `${auctioneerName} is auctioning... (Turn ${state.turnNumber})`;
      this.turnText.setText(turnStatus);
    }

    // Hide timer when no auction is active
    if (!state.auction?.timerEndsAt) {
      this.timerText.setVisible(false);
    }

    // Update hand
    this.updateHandPanel(myPlayer, isMyTurn);

    // Update auction panel
    if (state.auction && state.phase === 'playing') {
      this.updateAuctionPanel(state, isMyTurn, myPlayer);
    } else if (state.phase === 'lobby') {
      this.updateLobbyPanel();
    } else {
      this.clearAuctionPanel();
    }

    // Update others panel
    this.updateOthersPanel(state, myPlayer);

    // Update value sheet
    if (this.myValueSheet) {
      const sheetStr = Object.entries(this.myValueSheet)
        .map(([type, val]) => `${type}: ${val}`)
        .join(' | ');
      this.valueSheetText.setText(`Your values: ${sheetStr}`);
    }
  }

  private updateHandPanel(myPlayer: PlayerState | undefined, isMyTurn: boolean) {
    this.handContainer.removeAll(true);

    if (!myPlayer) return;

    let y = 0;
    for (const goat of myPlayer.hand) {
      const color = GOAT_COLORS[goat.type];
      const rect = this.add.rectangle(0, y, 120, 50, color);
      const label = this.add.text(60, y + 25, goat.type, {
        fontSize: '12px',
        color: '#fff',
      }).setOrigin(0.5);

      if (isMyTurn) {
        rect.setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => {
          this.room.send('PutUpForAuction', { goatId: goat.id });
        });
      }

      this.handContainer.add(rect);
      this.handContainer.add(label);

      y += 60;
    }
  }

  private updateLobbyPanel() {
    this.auctionPanel.removeAll(true);

    const title = this.add.text(0, 0, 'Waiting for game to start...', {
      fontSize: '18px',
      color: '#666',
    });

    const startBtn = this.add
      .text(0, 50, 'Start Game', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#667eea',
        padding: { left: 20, right: 20, top: 10, bottom: 10 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.room.send('StartGame', {});
      });

    this.auctionPanel.add(title);
    this.auctionPanel.add(startBtn);
  }

  private updateAuctionPanel(
    state: GameState,
    isMyTurn: boolean,
    myPlayer: PlayerState | undefined
  ) {
    this.auctionPanel.removeAll(true);
    this.lockCountdownText = null; // stale ref — children were just destroyed

    if (!state.auction) {
      this.clearAuctionPanel();
      return;
    }

    const auction = state.auction;
    const amAuctioneer = myPlayer?.id === auction.auctioneerPlayerId;

    // Goat on offer
    const goatColor = GOAT_COLORS[auction.goatOnOffer.type];
    const goatRect = this.add.rectangle(0, 0, 150, 80, goatColor);
    const goatLabel = this.add.text(75, 40, auction.goatOnOffer.type, {
      fontSize: '14px',
      color: '#fff',
    }).setOrigin(0.5);

    this.auctionPanel.add(goatRect);
    this.auctionPanel.add(goatLabel);

    // Bids list
    let y = 100;
    const bidsTitle = this.add.text(0, y, 'Bids:', {
      fontSize: '14px',
      color: '#333',
      fontStyle: 'bold',
    });
    this.auctionPanel.add(bidsTitle);

    y += 30;

    if (auction.bids.length === 0) {
      const noBidsText = this.add.text(0, y, 'No bids yet', {
        fontSize: '12px',
        color: '#999',
      });
      this.auctionPanel.add(noBidsText);
      y += 30;
    } else {
      for (const bidEntry of auction.bids) {
        const bidder = state.players.find((p) => p.id === bidEntry.bidderId);
        const isHeld = auction.heldBidderId === bidEntry.bidderId;

        // Build bid description (cash + goat types)
        const goatNames = bidEntry.bid.goats.map((g) => g.type).join(', ');
        const bidDesc = bidEntry.bid.goats.length > 0
          ? `${bidEntry.bid.cash} cash + [${goatNames}]`
          : `${bidEntry.bid.cash} cash`;

        // Held row highlight — visible to all players
        if (isHeld) {
          const highlight = this.add.rectangle(-4, y - 2, 500, 26, 0xfffde7).setOrigin(0);
          this.auctionPanel.add(highlight);
        }

        // Bid text (★ prefix for held bids)
        const heldPrefix = isHeld ? '★ ' : '';
        const bidText = this.add.text(
          0,
          y,
          `${heldPrefix}${bidder?.name}: ${bidDesc}`,
          {
            fontSize: '12px',
            color: isHeld ? '#22aa22' : '#333',
            fontStyle: isHeld ? 'bold' : 'normal',
          }
        );
        this.auctionPanel.add(bidText);

        // "HELD" badge visible to everyone when this bid is held
        if (isHeld) {
          const heldBadge = this.add.text(220, y, 'HELD', {
            fontSize: '10px',
            color: '#fff',
            backgroundColor: '#22aa22',
            padding: { left: 5, right: 5, top: 2, bottom: 2 },
          });
          this.auctionPanel.add(heldBadge);
        }

        // Auctioneer controls: Accept / [Hold or held indicator] / Reject
        if (amAuctioneer) {
          const acceptBtn = this.add
            .text(260, y, 'Accept', {
              fontSize: '11px',
              color: '#fff',
              backgroundColor: '#44b944',
              padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
              this.room.send('AcceptBid', { bidderId: bidEntry.bidderId });
            });

          // Only show Hold button when this bid is NOT already held
          if (!isHeld) {
            const holdBtn = this.add
              .text(320, y, 'Hold', {
                fontSize: '11px',
                color: '#fff',
                backgroundColor: '#e6a817',
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
              })
              .setInteractive({ useHandCursor: true })
              .on('pointerdown', () => {
                this.room.send('HoldBid', { bidderId: bidEntry.bidderId });
              });
            this.auctionPanel.add(holdBtn);
          }

          const rejectBtn = this.add
            .text(isHeld ? 320 : 370, y, 'Reject', {
              fontSize: '11px',
              color: '#fff',
              backgroundColor: '#cc3333',
              padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
              this.room.send('RejectBid', { bidderId: bidEntry.bidderId });
            });

          this.auctionPanel.add(acceptBtn);
          this.auctionPanel.add(rejectBtn);
        }

        // Retract controls — only for the local player's own bid, when not held
        if (bidEntry.bidderId === this.myPlayerId && !isHeld) {
          const placedAt = bidEntry.bidPlacedAt ?? 0;
          const lockMsLeft = placedAt + BID_LOCK_SECONDS * 1000 - Date.now();

          if (lockMsLeft > 0) {
            // Lock still active: show countdown text (updated every frame in update())
            const countdownText = this.add.text(0, y + 16, `Can retract in ${Math.ceil(lockMsLeft / 1000)}s`, {
              fontSize: '11px',
              color: '#999',
              fontStyle: 'italic',
            });
            this.auctionPanel.add(countdownText);
            this.lockCountdownText = countdownText;

            // Schedule a re-render for when the lock expires so the Retract button appears
            if (this.bidLockTimeout === null) {
              this.bidLockTimeout = setTimeout(() => {
                this.bidLockTimeout = null;
                this.updateUI();
              }, lockMsLeft + 50);
            }
          } else {
            // Lock expired: show Retract button
            const retractBtn = this.add
              .text(0, y + 16, 'Retract bid', {
                fontSize: '11px',
                color: '#fff',
                backgroundColor: '#888',
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
              })
              .setInteractive({ useHandCursor: true })
              .on('pointerdown', () => {
                this.room.send('RetractBid', {});
              });
            this.auctionPanel.add(retractBtn);
          }

          y += 22; // extra vertical space for the retract row
        }

        y += 30;
      }
    }

    // Bid composer — only for non-auctioneer players
    if (!amAuctioneer && myPlayer) {
      y += 20;

      // --- Goat selector overlay ---
      this.updateGoatSelectorOverlay(myPlayer, y);

      y += myPlayer.hand.length * 32 + 10;

      // --- Cash input ---
      const bidLabel = this.add.text(0, y, 'Cash to offer:', {
        fontSize: '12px',
        color: '#333',
      });
      this.auctionPanel.add(bidLabel);

      y += 30;

      if (!this.bidInputOverlay) {
        this.bidInputOverlay = document.createElement('input');
        this.bidInputOverlay.type = 'text';
        this.bidInputOverlay.inputMode = 'numeric';
        this.bidInputOverlay.placeholder = '0';
        this.bidInputOverlay.style.position = 'absolute';
        this.bidInputOverlay.style.width = '100px';
        this.bidInputOverlay.style.padding = '5px';
        this.bidInputOverlay.style.fontSize = '14px';
        this.bidInputOverlay.style.border = '2px solid #667eea';
        this.bidInputOverlay.style.borderRadius = '4px';
        document.body.appendChild(this.bidInputOverlay);
      }

      const canvasRect = this.game.canvas.getBoundingClientRect();
      this.bidInputOverlay.style.left = canvasRect.left + 400 + 'px';
      this.bidInputOverlay.style.top = canvasRect.top + 80 + y + 'px';
      this.bidInputOverlay.style.display = 'block';

      y += 40;

      const bidBtn = this.add
        .text(0, y, 'Place Bid', {
          fontSize: '12px',
          color: '#fff',
          backgroundColor: '#667eea',
          padding: { left: 15, right: 15, top: 8, bottom: 8 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const amount = parseInt(this.bidInputOverlay?.value || '0', 10);
          const selectedGoats = (myPlayer?.hand ?? []).filter((g) =>
            this.selectedBidGoatIds.has(g.id)
          );
          const bid: Bid = { cash: isNaN(amount) ? 0 : amount, goats: selectedGoats };
          this.room.send('PlaceBid', { bid });
          if (this.bidInputOverlay) {
            this.bidInputOverlay.value = '';
          }
          this.selectedBidGoatIds.clear();
          this.updateUI();
        });
      this.auctionPanel.add(bidBtn);
    } else {
      // Hide bid composer overlays when it's the auctioneer's turn or no player
      this.hideBidComposerOverlays();
    }
  }

  private updateGoatSelectorOverlay(myPlayer: PlayerState, panelY: number) {
    // Remove existing overlay if any
    if (this.goatSelectorOverlay) {
      this.goatSelectorOverlay.remove();
      this.goatSelectorOverlay = null;
    }

    if (myPlayer.hand.length === 0) return;

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const container = document.createElement('div');
    container.id = 'goat-selector';
    container.style.position = 'absolute';
    container.style.left = canvasRect.left + 400 + 'px';
    container.style.top = canvasRect.top + 80 + panelY + 'px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const label = document.createElement('div');
    label.textContent = 'Goats to include:';
    label.style.fontSize = '12px';
    label.style.color = '#333';
    label.style.marginBottom = '4px';
    container.appendChild(label);

    for (const goat of myPlayer.hand) {
      const btn = document.createElement('button');
      const isSelected = this.selectedBidGoatIds.has(goat.id);
      btn.textContent = `${goat.type}`;
      btn.dataset['goatId'] = goat.id;
      btn.style.padding = '4px 10px';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
      btn.style.border = '2px solid #667eea';
      btn.style.borderRadius = '4px';
      btn.style.backgroundColor = isSelected ? '#667eea' : '#fff';
      btn.style.color = isSelected ? '#fff' : '#333';
      btn.addEventListener('click', () => {
        if (this.selectedBidGoatIds.has(goat.id)) {
          this.selectedBidGoatIds.delete(goat.id);
        } else {
          this.selectedBidGoatIds.add(goat.id);
        }
        // Refresh the toggle appearance without a full re-render
        btn.style.backgroundColor = this.selectedBidGoatIds.has(goat.id) ? '#667eea' : '#fff';
        btn.style.color = this.selectedBidGoatIds.has(goat.id) ? '#fff' : '#333';
      });
      container.appendChild(btn);
    }

    document.body.appendChild(container);
    this.goatSelectorOverlay = container;
  }

  private hideBidComposerOverlays() {
    if (this.bidInputOverlay) {
      this.bidInputOverlay.style.display = 'none';
    }
    if (this.goatSelectorOverlay) {
      this.goatSelectorOverlay.remove();
      this.goatSelectorOverlay = null;
    }
  }

  private clearAuctionPanel() {
    this.auctionPanel.removeAll(true);
    this.hideBidComposerOverlays();
    this.timerText.setVisible(false);
    this.lockCountdownText = null;
    if (this.bidLockTimeout !== null) {
      clearTimeout(this.bidLockTimeout);
      this.bidLockTimeout = null;
    }
  }

  private cleanupDomOverlays() {
    if (this.bidInputOverlay) {
      this.bidInputOverlay.remove();
      this.bidInputOverlay = null;
    }
    if (this.goatSelectorOverlay) {
      this.goatSelectorOverlay.remove();
      this.goatSelectorOverlay = null;
    }
  }

  private updateOthersPanel(state: GameState, myPlayer: PlayerState | undefined) {
    this.othersPanel.removeAll(true);

    const title = this.add.text(0, 0, 'Other Players', {
      fontSize: '14px',
      color: '#333',
      fontStyle: 'bold',
    });
    this.othersPanel.add(title);

    let y = 30;
    for (const player of state.players) {
      if (player.id === this.myPlayerId) continue;

      const nameText = this.add.text(0, y, `${player.name}`, {
        fontSize: '12px',
        color: '#333',
        fontStyle: 'bold',
      });
      const statsText = this.add.text(0, y + 20, `Goats: ${player.hand.length} | Cash: ${player.cash}`, {
        fontSize: '11px',
        color: '#666',
      });

      this.othersPanel.add(nameText);
      this.othersPanel.add(statsText);

      y += 60;
    }
  }
}
