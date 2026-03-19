import { showLobby } from './lobby';
import { startGame } from './game';

async function main() {
  await showLobby((room) => {
    startGame(room);
  });
}

main().catch(console.error);
