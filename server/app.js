import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { RoomManager, RoomError } from './room.js';

export const str = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
export const obj = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

export const DEFAULT_ORIGINS = ['https://npat-arena.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'];

export function createApp({ corsOrigins = DEFAULT_ORIGINS, pickLetter } = {}) {
  const app = express();
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: corsOrigins, methods: ['GET', 'POST'] } });

  const socketToPlayer = new Map();
  const manager = new RoomManager({
    pickLetter,
    onChange: (room) => {
      [...room.sockets].forEach((socketId) => {
        const playerId = socketToPlayer.get(socketId);
        io.to(socketId).emit('room:state', manager.sanitize(room, playerId));
      });
    },
  });

  const ack = (socket) => (handler) => (payload = {}, callback) => {
    if (typeof callback !== 'function') callback = () => {};
    try {
      const result = handler(payload) || {};
      callback({
        ok: true,
        ...(result && typeof result === 'object' ? result : {}),
      });
    } catch (err) {
      if (err instanceof RoomError) {
        callback({ ok: false, error: { code: err.code, message: err.message } });
      } else {
        console.error('[room error]', err);
        callback({ ok: false, error: { code: 'internal', message: 'Something went wrong — try again.' } });
      }
    }
  };

  io.on('connection', (socket) => {
    socket.on('room:create', ack(socket)((payload) => {
      const { room, player } = manager.createRoom(str(payload.name), socket.id);
      socketToPlayer.set(socket.id, player.id);
      manager.broadcast(room);
      return { playerId: player.id, state: manager.sanitize(room, player.id) };
    }));

    socket.on('room:join', ack(socket)((payload) => {
      const { room, player, reconnected } = manager.joinRoom(str(payload.code), str(payload.name), socket.id, str(payload.playerId) || null);
      socketToPlayer.set(socket.id, player.id);
      manager.broadcast(room);
      return { playerId: player.id, reconnected, state: manager.sanitize(room, player.id) };
    }));

    socket.on('room:settings', ack(socket)((payload) => {
      const playerId = socketToPlayer.get(socket.id);
      const room = manager.setSettings(str(payload.code), playerId, { totalRounds: payload.totalRounds, timerSeconds: payload.timerSeconds });
      return { state: manager.sanitize(room, playerId) };
    }));

    socket.on('room:start', ack(socket)((payload) => {
      const playerId = socketToPlayer.get(socket.id);
      const room = manager.startGame(str(payload.code), playerId);
      return { state: manager.sanitize(room, playerId) };
    }));

    socket.on('round:submit', ack(socket)((payload) => {
      const playerId = socketToPlayer.get(socket.id);
      const answers = obj(payload.answers);
      const room = manager.submit(str(payload.code), playerId, answers);
      return { state: manager.sanitize(room, playerId) };
    }));

    socket.on('round:next', ack(socket)((payload) => {
      const playerId = socketToPlayer.get(socket.id);
      const room = manager.nextRound(str(payload.code), playerId);
      return { state: manager.sanitize(room, playerId) };
    }));

    socket.on('room:playAgain', ack(socket)((payload) => {
      const playerId = socketToPlayer.get(socket.id);
      const room = manager.playAgain(str(payload.code), playerId);
      return { state: manager.sanitize(room, playerId) };
    }));

    socket.on('room:leave', () => {
      socketToPlayer.delete(socket.id);
      manager.leaveRoom(socket.id);
    });

    socket.on('disconnect', () => {
      socketToPlayer.delete(socket.id);
      manager.detachSocket(socket.id);
    });
  });

  const cleanup = setInterval(() => manager.cleanupExpired(), 30 * 1000);

  return {
    app,
    server,
    io,
    manager,
    socketToPlayer,
    close: () => {
      clearInterval(cleanup);
      io.close();
      server.closeAllConnections?.();
      server.close();
    },
  };
}