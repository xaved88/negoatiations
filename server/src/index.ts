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
const port = process.env.PORT ? parseInt(process.env.PORT) : SERVER_PORT;
httpServer.listen(port, () => {
  console.log(`🎮 Negoatiations server running on http://localhost:${port}`);
});
