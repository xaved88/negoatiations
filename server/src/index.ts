import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { GameRoom } from './rooms/GameRoom';
import { SERVER_PORT } from 'shared/constants';

const app = express();
const httpServer = createServer(app);
const gameServer = new Server({
  server: httpServer,
});

app.use(express.static('public'));

// Define the game room
gameServer.define('game', GameRoom);

// Start server
httpServer.listen(SERVER_PORT, () => {
  console.log(`🎮 Negoatiations server running on http://localhost:${SERVER_PORT}`);
});
