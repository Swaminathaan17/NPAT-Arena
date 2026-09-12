import { randomLetter, scoreRound } from '../src/game/scoring.js';
import { CATEGORY_KEYS } from '../src/game/categories.js';
import { canonicalize } from '../src/game/validation.js';

export const MAX_PLAYERS = 20;
export const MIN_PLAYERS = 2;
export const TIMER_OPTIONS = [30, 60, 90];
export const ROUND_OPTIONS = [1, 3, 5, 10];
export const DEFAULT_TIMER = 60;
export const DEFAULT_ROUNDS = 5;
export const MAX_NAME = 24;
export const MAX_ANSWER = 80;
export const CODE_LENGTH = 5;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMPTY_ROOM_TTL = 60 * 1000;

const PLAYER_COLORS = ['#A78BFA', '#34D399', '#F59E0B', '#60A5FA', '#F472B6', '#FB7185', '#22D3EE', '#C084FC', '#5FC7FF', '#68D5AE'];

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
const cleanAnswer = (value) => String(value || '').trim().slice(0, MAX_ANSWER);
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function generateCode(existing = new Set()) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!existing.has(code)) return code;
  }
  return null;
}

function createPlayer(name) {
  return { id: uid(), name, color: PLAYER_COLORS[0], socketIds: new Set(), connected: false, score: 0, lastScore: 0 };
}

export class Room {
  constructor(code, hostId, hostName) {
    this.code = code;
    this.hostId = hostId;
    this.totalRounds = DEFAULT_ROUNDS;
    this.timerSeconds = DEFAULT_TIMER;
    this.status = 'lobby';
    this.roundNumber = 0;
    this.letter = null;
    this.deadline = null;
    this.winnerId = null;
    this.players = new Map();
    this.submissions = new Map();
    this.roundLog = [];
    this.lastResults = null;
    this.timeout = null;
    this.createdAt = Date.now();
    this.emptySince = null;
    this.sockets = new Set();
  }
}

export class RoomManager {
  constructor({ onChange = () => {}, pickLetter = randomLetter } = {}) {
    this.rooms = new Map();
    this.codeIndex = new Set();
    this.onChange = onChange;
    this.pickLetter = pickLetter;
    this.lastColor = 0;
  }

  _nextColor() {
    const color = PLAYER_COLORS[this.lastColor % PLAYER_COLORS.length];
    this.lastColor += 1;
    return color;
  }

  broadcast(room) {
    this.onChange(room);
  }

  _checkHost(room, playerId) {
    if (room.hostId !== playerId) throw new RoomError('not_host', 'Only the host can do that.');
  }

  _requireStatus(room, status) {
    if (room.status !== status) throw new RoomError('bad_state', `Room is not in the ${status} state.`);
  }

  sanitize(room, viewerId = null) {
    const players = [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      connected: player.connected,
      isHost: player.id === room.hostId,
      score: player.score,
      lastScore: player.lastScore,
      isYou: player.id === viewerId,
    }));
    const submitted = {};
    if (room.status === 'playing') {
      [...room.players.values()].forEach((p) => { if (room.submissions.has(p.id)) submitted[p.id] = true; });
    }
    return {
      code: room.code,
      hostId: room.hostId,
      totalRounds: room.totalRounds,
      timerSeconds: room.timerSeconds,
      status: room.status,
      roundNumber: room.roundNumber,
      letter: room.letter,
      deadline: room.deadline,
      winnerId: room.winnerId,
      players,
      submitted,
      roundResults: room.status === 'results' || room.status === 'finished' ? room.lastResults : null,
      maxRoundScore: CATEGORY_KEYS.length * 10,
    };
  }

  getRoom(code) {
    const key = String(code || '').trim().toUpperCase();
    return this.rooms.get(key) || null;
  }

  roomOfSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.sockets.has(socketId)) return room;
    }
    return null;
  }

  createRoom(name, socketId) {
    const clean = cleanName(name);
    if (!clean) throw new RoomError('bad_name', 'Enter a name to play.');
    const code = generateCode(this.codeIndex);
    if (!code) throw new RoomError('full', 'Too many rooms right now — try again.');
    const player = createPlayer(clean);
    player.color = this._nextColor();
    player.connected = true;
    player.socketIds.add(socketId);
    const room = new Room(code, player.id);
    room.players.set(player.id, player);
    room.sockets.add(socketId);
    this.rooms.set(code, room);
    this.codeIndex.add(code);
    return { room, player };
  }

  joinRoom(code, name, socketId, existingPlayerId = null) {
    const clean = cleanName(name);
    if (!clean) throw new RoomError('bad_name', 'Enter a name to play.');
    const room = this.getRoom(code);
    if (!room) throw new RoomError('not_found', `No room with code ${String(code).toUpperCase()} — check and try again.`);

    let player = existingPlayerId ? room.players.get(existingPlayerId) || null : null;
    if (player) {
      if (player.connected) throw new RoomError('already_connected', 'This player is already connected — use another browser tab or choose a new name.');
      player.name = clean;
      player.socketIds.add(socketId);
      player.connected = true;
      room.sockets.add(socketId);
      room.emptySince = null;
      return { room, player, reconnected: true };
    }

    const existingByName = [...room.players.values()].find((p) => canonicalize(p.name) === canonicalize(clean));
    if (existingByName) {
      if (existingByName.connected) throw new RoomError('name_taken', `The name “${existingByName.name}” is already in this room.`);
      existingByName.name = clean;
      existingByName.socketIds.add(socketId);
      existingByName.connected = true;
      room.sockets.add(socketId);
      room.emptySince = null;
      return { room, player: existingByName, reconnected: true };
    }

    if (room.status !== 'lobby') throw new RoomError('game_in_progress', 'This game has already started.');
    if (room.players.size >= MAX_PLAYERS) throw new RoomError('full', 'That room is full (20 players).');

    const newPlayer = createPlayer(clean);
    newPlayer.color = this._nextColor();
    newPlayer.connected = true;
    newPlayer.socketIds.add(socketId);
    room.players.set(newPlayer.id, newPlayer);
    room.sockets.add(socketId);
    return { room, player: newPlayer, reconnected: false };
  }

  detachSocket(socketId) {
    const room = this.roomOfSocket(socketId);
    if (!room) return { room: null, playerId: null };
    room.sockets.delete(socketId);
    let playerId = null;
    [...room.players.values()].forEach((player) => {
      if (player.socketIds.delete(socketId) && player.socketIds.size === 0) {
        player.connected = false;
        playerId = player.id;
      }
    });
    if (room.sockets.size === 0) room.emptySince = Date.now();
    else room.emptySince = null;
    const hostPlayer = room.players.get(room.hostId);
    if (hostPlayer && !hostPlayer.connected) this._assignHost(room);
    if (room.sockets.size > 0) this.broadcast(room);
    return { room, playerId };
  }

  leaveRoom(socketId) {
    const { room, playerId } = this.detachSocket(socketId);
    if (!room || !playerId) return null;
    const player = room.players.get(playerId);
    if (player) room.players.delete(playerId);
    if (room.players.size === 0) {
      this.deleteRoom(room.code);
      return room;
    }
    if (room.hostId === playerId) this._assignHost(room);
    this.broadcast(room);
    return room;
  }

  _assignHost(room) {
    const connected = [...room.players.values()].filter((p) => p.connected);
    const next = connected[0] || (room.status === 'lobby' ? [...room.players.values()][0] : null);
    room.hostId = next ? next.id : room.hostId;
  }

  setSettings(code, playerId, { totalRounds, timerSeconds }) {
    const room = this.getRoom(code);
    if (!room) throw new RoomError('not_found', 'Room not found.');
    this._checkHost(room, playerId);
    this._requireStatus(room, 'lobby');
    if (ROUND_OPTIONS.includes(Number(totalRounds))) room.totalRounds = Number(totalRounds);
    else if (Number.isFinite(Number(totalRounds))) room.totalRounds = Math.min(15, Math.max(1, Math.round(Number(totalRounds))));
    if (TIMER_OPTIONS.includes(Number(timerSeconds))) room.timerSeconds = Number(timerSeconds);
    else if (Number.isFinite(Number(timerSeconds))) room.timerSeconds = Math.min(90, Math.max(30, Math.round(Number(timerSeconds))));
    this.broadcast(room);
    return room;
  }

  startGame(code, playerId) {
    const room = this.getRoom(code);
    if (!room) throw new RoomError('not_found', 'Room not found.');
    this._checkHost(room, playerId);
    this._requireStatus(room, 'lobby');
    const connected = [...room.players.values()].filter((p) => p.connected).length;
    if (connected < MIN_PLAYERS) throw new RoomError('need_players', `Need at least ${MIN_PLAYERS} connected players to start.`);
    [...room.players.values()].forEach((p) => { p.score = 0; p.lastScore = 0; });
    this._beginRound(room);
    return room;
  }

  _beginRound(room) {
    room.status = 'playing';
    room.roundNumber += 1;
    room.letter = this.pickLetter(room.roundLog.map((r) => r.letter));
    room.deadline = Date.now() + room.timerSeconds * 1000;
    room.submissions = new Map();
    room.lastResults = null;
    if (room.timeout) clearTimeout(room.timeout);
    room.timeout = setTimeout(() => this.completeRound(room.code), room.timerSeconds * 1000 + 50);
    room.timeout.unref();
    this.broadcast(room);
  }

  submit(code, playerId, rawAnswers) {
    const room = this.getRoom(code);
    if (!room) throw new RoomError('not_found', 'Room not found.');
    this._requireStatus(room, 'playing');
    const player = room.players.get(playerId);
    if (!player) throw new RoomError('not_in_room', 'You are not in this room.');
    if (room.submissions.has(playerId)) throw new RoomError('already_submitted', 'You already submitted this round.');

    const cleaned = {};
    CATEGORY_KEYS.forEach((key) => {
      const value = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers[key] : '';
      cleaned[key] = typeof value === 'string' ? cleanAnswer(value) : '';
    });
    room.submissions.set(playerId, { ...cleaned, submittedAt: Date.now() });

    const connected = [...room.players.values()].filter((p) => p.connected);
    const allSubmitted = connected.every((p) => room.submissions.has(p.id));
    this.broadcast(room);
    if (allSubmitted && room.status === 'playing') this.completeRound(room.code);
    return room;
  }

  completeRound(code) {
    const room = this.getRoom(code);
    if (!room || room.status !== 'playing') return null;
    if (room.timeout) { clearTimeout(room.timeout); room.timeout = null; }
    const roster = [...room.players.values()].map((p) => ({ id: p.id, name: p.name }));
    const submissions = {};
    room.submissions.forEach((value, playerId) => { submissions[playerId] = value; });
    const scored = scoreRound({ players: roster, submissions, letter: room.letter });
    const byId = Object.fromEntries(scored.map((r) => [r.playerId, r]));
    [...room.players.values()].forEach((player) => {
      const result = byId[player.id];
      player.lastScore = result ? result.total : 0;
      player.score += player.lastScore;
    });
    room.roundLog.push({ round: room.roundNumber, letter: room.letter, results: scored });
    room.lastResults = scored;
    room.submissions = new Map();
    if (room.roundNumber >= room.totalRounds) {
      room.status = 'finished';
      const ranked = [...room.players.values()].sort((a, b) => b.score - a.score);
      room.winnerId = ranked.length > 1 && ranked[0].score === ranked[1].score ? null : (ranked[0]?.id || null);
    } else {
      room.status = 'results';
    }
    this.broadcast(room);
    return room;
  }

  nextRound(code, playerId) {
    const room = this.getRoom(code);
    if (!room) throw new RoomError('not_found', 'Room not found.');
    this._checkHost(room, playerId);
    this._requireStatus(room, 'results');
    this._beginRound(room);
    return room;
  }

  playAgain(code, playerId) {
    const room = this.getRoom(code);
    if (!room) throw new RoomError('not_found', 'Room not found.');
    this._checkHost(room, playerId);
    this._requireStatus(room, 'finished');
    room.status = 'lobby';
    room.roundNumber = 0;
    room.letter = null;
    room.deadline = null;
    room.winnerId = null;
    room.roundLog = [];
    room.lastResults = null;
    room.submissions = new Map();
    [...room.players.values()].forEach((p) => { p.score = 0; p.lastScore = 0; });
    this.broadcast(room);
    return room;
  }

  deleteRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.timeout) clearTimeout(room.timeout);
    this.rooms.delete(code);
    this.codeIndex.delete(code);
  }

  cleanupExpired(now = Date.now()) {
    for (const room of [...this.rooms.values()]) {
      if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL) this.deleteRoom(room.code);
    }
  }
}
