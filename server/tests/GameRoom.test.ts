/**
 * GameRoom integration tests.
 *
 * These test the room's full message-handling lifecycle without a real network.
 * A fake Client stub captures sent messages so we can assert on them.
 * This is the layer that would have caught the setState/Schema crash.
 */

import { GameRoom } from '../src/rooms/GameRoom';
import { GoatType } from 'shared/types';
import { TURNS_PER_GAME, STARTING_CASH } from 'shared/constants';

// ---------------------------------------------------------------------------
// Fake client — captures messages sent to it
// ---------------------------------------------------------------------------

interface SentMessage {
  type: string;
  data: unknown;
}

class FakeClient {
  sessionId: string;
  messages: SentMessage[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  send(type: string, data: unknown) {
    this.messages.push({ type, data });
  }

  lastMessage(type: string): unknown {
    const found = [...this.messages].reverse().find((m) => m.type === type);
    return found ? found.data : undefined;
  }

  clearMessages() {
    this.messages = [];
  }
}

// ---------------------------------------------------------------------------
// Fake room helpers — drive the room without a real Colyseus server
// ---------------------------------------------------------------------------

function makeRoom(): GameRoom {
  const room = new GameRoom();
  // Stub Colyseus methods that require a live matchmaker/server context
  (room as unknown as Record<string, unknown>).setMetadata = () => { /* no-op in tests */ };
  // Stub out broadcast so it doesn't try to access real WebSocket infrastructure
  (room as unknown as Record<string, unknown>).broadcast = (
    type: string,
    data: unknown,
    opts?: { except?: FakeClient }
  ) => {
    const clientList: FakeClient[] = (room as unknown as Record<string, unknown>).clients as FakeClient[];
    for (const c of clientList) {
      if (opts?.except && opts.except.sessionId === c.sessionId) continue;
      c.send(type, data);
    }
  };
  (room as unknown as Record<string, unknown>).clients = [];
  room.onCreate();
  return room;
}

function joinRoom(room: GameRoom, client: FakeClient, name: string) {
  const clients = (room as unknown as Record<string, unknown>).clients as FakeClient[];
  clients.push(client);
  room.onJoin(client as unknown as import('colyseus').Client, { name });
}

function sendMessage(room: GameRoom, client: FakeClient, type: string, data: unknown) {
  // Colyseus 0.15 stores handlers in a plain object: this.onMessageHandlers[type]
  const handlers = (room as unknown as Record<string, Record<string, Function>>)['onMessageHandlers'];
  const handler = handlers?.[type];
  if (handler) {
    handler(client as unknown as import('colyseus').Client, data);
  } else {
    throw new Error(`No handler registered for message type: "${type}"`);
  }
}

// ---------------------------------------------------------------------------
// Helper to run a full game quickly
// ---------------------------------------------------------------------------

function getState(room: GameRoom) {
  return (room as unknown as Record<string, unknown>)['gameState'] as import('shared/types').GameState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameRoom - setup', () => {
  it('initialises with lobby phase and no players', () => {
    const room = makeRoom();
    const state = getState(room);
    expect(state.phase).toBe('lobby');
    expect(state.players).toHaveLength(0);
    expect(state.auction).toBeNull();
  });

  it('adds a player on join and sends stateUpdate', () => {
    const room = makeRoom();
    const alice = new FakeClient('alice-session');
    joinRoom(room, alice, 'Alice');

    const state = getState(room);
    expect(state.players).toHaveLength(1);
    expect(state.players[0].name).toBe('Alice');
    expect(state.players[0].cash).toBe(STARTING_CASH);

    // Player ID is the sessionId — no separate yourPlayerId message needed
    expect(state.players[0].id).toBe('alice-session');
    expect(alice.messages.find((m) => m.type === 'stateUpdate')).toBeDefined();
  });

  it('does NOT call setState (regression: would crash Colyseus binary serialiser)', () => {
    // If setState were called, this.state would be a plain object, causing
    // "TypeError: bytes is not iterable" in Colyseus's Protocol.js sendFullState.
    // Verify this.state is never set to a plain object.
    const room = makeRoom();
    const colyseusState = (room as unknown as Record<string, unknown>)['state'];
    // state should be undefined — we use gameState instead
    expect(colyseusState).toBeUndefined();
  });

  it('allows single-player start (solo vs bots)', () => {
    const room = makeRoom();
    const alice = new FakeClient('alice-session');
    joinRoom(room, alice, 'Alice');

    sendMessage(room, alice, 'StartGame', {});
    expect(getState(room).phase).toBe('playing'); // game starts with 1 human + 4 bots
    expect(getState(room).players).toHaveLength(5); // filled to MAX_PLAYERS
  });
});

describe('GameRoom - game start', () => {
  function setupTwoPlayerRoom() {
    const room = makeRoom();
    const alice = new FakeClient('alice-session');
    const bob = new FakeClient('bob-session');
    joinRoom(room, alice, 'Alice');
    joinRoom(room, bob, 'Bob');
    return { room, alice, bob };
  }

  it('transitions to playing phase on StartGame', () => {
    const { room, alice } = setupTwoPlayerRoom();
    sendMessage(room, alice, 'StartGame', {});
    expect(getState(room).phase).toBe('playing');
  });

  it('deals goats to all players', () => {
    const { room, alice } = setupTwoPlayerRoom();
    sendMessage(room, alice, 'StartGame', {});
    const state = getState(room);
    for (const player of state.players) {
      expect(player.hand.length).toBeGreaterThan(0);
      for (const goat of player.hand) {
        expect(Object.values(GoatType)).toContain(goat.type);
      }
    }
  });

  it('sends private yourValueSheet to each player', () => {
    const { room, alice, bob } = setupTwoPlayerRoom();
    alice.clearMessages();
    bob.clearMessages();
    sendMessage(room, alice, 'StartGame', {});

    const aliceSheet = alice.messages.find((m) => m.type === 'yourValueSheet');
    const bobSheet = bob.messages.find((m) => m.type === 'yourValueSheet');
    expect(aliceSheet).toBeDefined();
    expect(bobSheet).toBeDefined();
  });

  it('does not include value sheets in the broadcast stateUpdate', () => {
    const { room, alice, bob } = setupTwoPlayerRoom();
    alice.clearMessages();
    bob.clearMessages();
    sendMessage(room, alice, 'StartGame', {});

    const aliceState = alice.messages.find((m) => m.type === 'stateUpdate')?.data as Record<string, unknown>;
    expect(aliceState).toBeDefined();
    // Value sheets must NOT appear in the public state
    expect(aliceState['valueSheets']).toBeUndefined();
    expect(aliceState['playerValueSheets']).toBeUndefined();
  });
});

describe('GameRoom - auction flow', () => {
  function setupStartedGame() {
    const room = makeRoom();
    const alice = new FakeClient('alice-session');
    const bob = new FakeClient('bob-session');
    joinRoom(room, alice, 'Alice');
    joinRoom(room, bob, 'Bob');
    sendMessage(room, alice, 'StartGame', {});

    const aliceId = 'alice-session';
    const bobId = 'bob-session';

    // After StartGame, players are shuffled for production randomness.
    // Patch the auctioneer index to point to Alice so auction-flow tests
    // remain deterministic without changing production behaviour.
    const state = getState(room);
    const aliceIdx = state.players.findIndex((p) => p.id === aliceId);
    state.currentAuctioneerIndex = aliceIdx;

    return { room, alice, bob, aliceId, bobId };
  }

  it('sets auction state when auctioneer puts up a goat', () => {
    const { room, alice, aliceId } = setupStartedGame();
    const state = getState(room);

    // Alice is player[0] so she should be first auctioneer (index 0)
    const alicePlayer = state.players.find((p) => p.id === aliceId);
    expect(alicePlayer).toBeDefined();
    const goatId = alicePlayer!.hand[0].id;

    sendMessage(room, alice, 'PutUpForAuction', { goatId });
    expect(getState(room).auction).not.toBeNull();
    expect(getState(room).auction?.auctioneerPlayerId).toBe(aliceId);
    expect(getState(room).auction?.goatOnOffer.id).toBe(goatId);
  });

  it('rejects PutUpForAuction from non-auctioneer', () => {
    const { room, bob } = setupStartedGame();
    const state = getState(room);
    const bobPlayer = state.players.find((p) => p.id !== state.players[0].id);
    const goatId = bobPlayer!.hand[0].id;

    sendMessage(room, bob, 'PutUpForAuction', { goatId });
    expect(getState(room).auction).toBeNull();
  });

  it('records a valid bid from the non-auctioneer', () => {
    const { room, alice, bob, aliceId } = setupStartedGame();
    const state = getState(room);
    const goatId = state.players.find((p) => p.id === aliceId)!.hand[0].id;

    sendMessage(room, alice, 'PutUpForAuction', { goatId });
    sendMessage(room, bob, 'PlaceBid', { bid: { cash: 10, goats: [] } });

    expect(getState(room).auction?.bids).toHaveLength(1);
    expect(getState(room).auction?.bids[0].bid.cash).toBe(10);
  });

  it('rejects a bid the bidder cannot afford', () => {
    const { room, alice, bob, aliceId } = setupStartedGame();
    const goatId = getState(room).players.find((p) => p.id === aliceId)!.hand[0].id;

    sendMessage(room, alice, 'PutUpForAuction', { goatId });
    sendMessage(room, bob, 'PlaceBid', { bid: { cash: STARTING_CASH + 1, goats: [] } });

    expect(getState(room).auction?.bids).toHaveLength(0);
  });

  it('transfers goat and cash on AcceptBid', () => {
    const { room, alice, bob, aliceId, bobId } = setupStartedGame();
    const goatId = getState(room).players.find((p) => p.id === aliceId)!.hand[0].id;
    const aliceCashBefore = getState(room).players.find((p) => p.id === aliceId)!.cash;

    sendMessage(room, alice, 'PutUpForAuction', { goatId });
    sendMessage(room, bob, 'PlaceBid', { bid: { cash: 20, goats: [] } });
    sendMessage(room, alice, 'AcceptBid', { bidderId: bobId });

    const state = getState(room);
    const aliceAfter = state.players.find((p) => p.id === aliceId)!;
    const bobAfter = state.players.find((p) => p.id === bobId)!;

    expect(aliceAfter.cash).toBe(aliceCashBefore + 20);
    expect(bobAfter.cash).toBe(STARTING_CASH - 20);
    expect(bobAfter.hand.some((g) => g.id === goatId)).toBe(true);
    expect(aliceAfter.hand.some((g) => g.id === goatId)).toBe(false);
    expect(state.auction).toBeNull();
  });

  it('advances turn after AcceptBid', () => {
    const { room, alice, bob, aliceId, bobId } = setupStartedGame();
    const aliceIdx = getState(room).currentAuctioneerIndex;
    const playerCount = getState(room).players.length;
    const expectedNextIdx = (aliceIdx + 1) % playerCount;
    const goatId = getState(room).players.find((p) => p.id === aliceId)!.hand[0].id;

    sendMessage(room, alice, 'PutUpForAuction', { goatId });
    sendMessage(room, bob, 'PlaceBid', { bid: { cash: 5, goats: [] } });
    sendMessage(room, alice, 'AcceptBid', { bidderId: bobId });

    expect(getState(room).turnNumber).toBe(1);
    expect(getState(room).currentAuctioneerIndex).toBe(expectedNextIdx); // advanced by 1
  });
});

describe('GameRoom - game over', () => {
  it(`ends after ${TURNS_PER_GAME} turns and broadcasts gameOver with value sheets`, () => {
    // Use fake timers so bot turns (which are timer-driven) execute synchronously.
    jest.useFakeTimers();
    try {
      const room = makeRoom();
      const alice = new FakeClient('alice-session');
      const bob = new FakeClient('bob-session');
      joinRoom(room, alice, 'Alice');
      joinRoom(room, bob, 'Bob');
      sendMessage(room, alice, 'StartGame', {});

      const aliceId = 'alice-session';
      const bobId = 'bob-session';

      // After StartGame, players are shuffled so we don't know the turn order
      // in advance. Drive human turns (Alice / Bob) whenever it's their index;
      // advance fake timers for bot turns. runOnlyPendingTimers() fires only
      // the timers pending at the moment of each call, so timer-chains don't
      // run away; each loop iteration advances one "generation" of bot actions.
      let safetyLimit = 400;
      while (getState(room).phase === 'playing' && safetyLimit-- > 0) {
        const state = getState(room);

        // If an auction is already open, advance timers to let bots bid/accept
        if (state.auction) {
          jest.runOnlyPendingTimers();
          continue;
        }

        // No auction yet — check whether the current auctioneer is a human
        const auctioneerIdx = state.currentAuctioneerIndex;
        const auctioneer = state.players[auctioneerIdx];

        if (auctioneer.id === aliceId) {
          const alicePlayer = state.players.find((p) => p.id === aliceId)!;
          sendMessage(room, alice, 'PutUpForAuction', { goatId: alicePlayer.hand[0].id });
          sendMessage(room, bob, 'PlaceBid', { bid: { cash: 1, goats: [] } });
          sendMessage(room, alice, 'AcceptBid', { bidderId: bobId });
        } else if (auctioneer.id === bobId) {
          const bobPlayer = state.players.find((p) => p.id === bobId)!;
          sendMessage(room, bob, 'PutUpForAuction', { goatId: bobPlayer.hand[0].id });
          sendMessage(room, alice, 'PlaceBid', { bid: { cash: 1, goats: [] } });
          sendMessage(room, bob, 'AcceptBid', { bidderId: aliceId });
        } else {
          // Bot auctioneer — advance timers to let it put up a goat (and others bid)
          jest.runOnlyPendingTimers();
        }
      }
      expect(safetyLimit).toBeGreaterThan(0); // guard against broken loops

      const finalState = getState(room);
      expect(finalState.phase).toBe('ended');
      expect(finalState.scores).not.toBeNull();

      // Both human players should have received a gameOver event
      const aliceGameOver = alice.messages.find((m) => m.type === 'gameOver')?.data as Record<string, unknown>;
      expect(aliceGameOver).toBeDefined();
      expect(aliceGameOver['valueSheets']).toBeDefined();
      expect(aliceGameOver['scores']).toBeDefined();
      // playerNames must be present so the score screen can show names instead of session IDs
      expect(aliceGameOver['playerNames']).toBeDefined();
      const playerNames = aliceGameOver['playerNames'] as Record<string, string>;
      expect(playerNames['alice-session']).toBe('Alice');
      expect(playerNames['bob-session']).toBe('Bob');
    } finally {
      jest.useRealTimers();
    }
  });
});
