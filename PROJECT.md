# Negoatiations

A multiplayer, competitive betting/haggling/social deduction card game where players trade goats to maximize their hidden value sheet.

---

## Game Overview

Players are dealt a hand of goats, each with a type (e.g. Silly, Angry, Happy, Hungry) that determines their appearance. Every player has a secret value sheet that assigns different point values to different goat types. The goal is to end the game with the highest combined value of goats + cash — but since values are hidden, the real game is figuring out what your opponents want while concealing what you want.

Rounds are short (5–10 minutes) and the tone is light, cartoonish, and funny.

---

## Players

- **Seats:** Up to 5 (human or AI bot)
- **Lobby:** Games are publicly listed as "{Player Name}'s game" and anyone can join before the game starts. No spectating once a game is in progress.
- **Min to start:** TBD (likely 2–3)

---

## Core Mechanics

### Setup
- Each player is dealt a hand of goats (type and count TBD)
- Each player receives a starting cash balance
- Each player receives a unique, secret **value sheet** mapping goat types to point values

### Goat Types
- Silly Goat
- Angry Goat
- Happy Goat
- Hungry Goat
- *(More types may be added; each has a distinct face, color, and light idle animation)*

### Turn Structure
On their turn, a player selects one goat from their hand to put up for **auction**.

Other players submit **bids** — any combination of:
- Cash
- One or more goats from their own hand

The auctioning player can:
- **Accept** a bid immediately (ends the auction for that goat)
- **Hold** — accept a bid as the current best but keep taking new bids (competitive pressure)
- **Reject** a bid

Auction ends when the auctioneer accepts a final offer or a time/turn limit is reached.

### End Condition
The game ends after a fixed number of turns or a time limit. Each player's score is calculated as:

```
Score = Cash Balance + Sum of (Goat Count × Value per type from their secret sheet)
```

Highest score wins.

---

## Strategy & Fun
The tension comes from:
- **Inferring others' value sheets** by watching what they bid and how eagerly they accept offers
- **Bluffing** — bidding on goats you don't actually want to drive up prices or mislead others
- **Timing** — holding out for better offers vs. locking in a deal before someone else swoops in
- **AI bots** fill empty seats, providing competition and strategic noise even in smaller sessions

---

## Visual Style
- 2D, cartoony, humorous, and cute
- Each goat type has a distinct face and color palette
- Light idle animations on goat cards (e.g. ear wiggles, blinking, chewing)
- UI is playful but legible — prioritizing quick reads during fast auction windows

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TypeScript + Phaser 3 |
| Backend | Node.js (TypeScript) |
| Networking | Colyseus (authoritative server, real-time sync) |
| Testing | Unit tests for game logic; UI/integration tests for core features |

### Architecture Principles
- **Authoritative server:** All game state lives on the server (Colyseus room). Clients are dumb renderers.
- **Testability first:** Game logic is pure and unit-testable. UI flows have dedicated UI tests so that AI-assisted iteration is safe and fast.
- **Modular state:** Game state, auction logic, and scoring are isolated modules — easy to test, easy to swap.

---

## Development Environment
- Local dev only (initial phase)
- Frontend dev server + Colyseus local server run in tandem
- Environment configured via `.env` files (not committed)
