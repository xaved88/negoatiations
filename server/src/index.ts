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

// Define game rooms before starting the server
gameServer.define('game', GameRoom);

// Serve the built client (populated by the build step).
// Colyseus intercepts /matchmake/* at the HTTP server level before Express
// ever sees those requests, so middleware ordering doesn't affect matchmaking.
app.use(express.static('public'));

// Health check for Render and monitoring
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// Use gameServer.listen() instead of httpServer.listen() directly.
// This ensures matchMaker.accept() is called, which sets the matchmaker to
// READY state and registers the process for discovery — required for room
// creation and listing to work correctly in production.
const port = process.env.PORT ? parseInt(process.env.PORT) : SERVER_PORT;
gameServer.listen(port).then(() => {
  console.log(`🎮 Negoatiations server running on port ${port}`);
}).catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
