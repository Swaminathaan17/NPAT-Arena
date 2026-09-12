import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROUNDS, DEFAULT_TIMER, MAX_NAME, MAX_PLAYERS, RoomError, RoomManager } from './room.js';

const uid = () => `${Math.random().toString(36).slice(2)}`;

function makeManager() {
  return new RoomManager({ onChange: () => {}, pickLetter: () => 'R' });
}

test('createRoom: host becomes owner, code is short and readable', () => {
  const manager = makeManager();
  const { room, player } = manager.createRoom('Ravi', 'sock-1');
  assert.match(room.code, /^[A-Z2-9]{5}$/);
  assert.equal(room.hostId, player.id);
  assert.equal(room.status, 'lobby');
  assert.equal(room.players.size, 1);
  const state = manager.sanitize(room, player.id);
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].isHost, true);
  assert.equal(state.players[0].isYou, true);
  assert.ok(state.players[0].color);
});

test('joinRoom: second player appears in the lobby', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const { player: joined } = manager.joinRoom(room.code, 'Sita', 'sock-2');
  assert.equal(room.players.size, 2);
  assert.equal(manager.sanitize(room).players.length, 2);
  assert.ok([...room.players.values()].some((p) => p.name === 'Sita' && p.id === joined.id));
});

test('joinRoom: invalid code throws not_found', () => {
  const manager = makeManager();
  assert.throws(() => manager.joinRoom('NOPE5', 'Ravi', 'sock-1'), (err) => err instanceof RoomError && err.code === 'not_found');
});

test('joinRoom: blank name is rejected and long names are truncated', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  assert.throws(() => manager.joinRoom(room.code, '', 'sock-2'), (err) => err.code === 'bad_name');
  const longName = 'x'.repeat(200);
  const { player } = manager.joinRoom(room.code, longName, 'sock-2');
  assert.ok(player.name.length <= MAX_NAME);
});

test('joinRoom: duplicate name is rejected', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  assert.throws(() => manager.joinRoom(room.code, ' ravi ', 'sock-2'), (err) => err.code === 'name_taken');
});

test('joinRoom: room full rejects extra players', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('P1', 's0');
  for (let i = 1; i < MAX_PLAYERS; i++) manager.joinRoom(room.code, `P${i + 1}`, `s${i}`);
  assert.equal(room.players.size, MAX_PLAYERS);
  assert.throws(() => manager.joinRoom(room.code, 'Overflow', 's-extra'), (err) => err.code === 'full');
});

test('joinRoom: cannot join a game in progress as a brand-new player', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('P1', 's1');
  manager.joinRoom(room.code, 'P2', 's2');
  manager.startGame(room.code, room.hostId);
  assert.equal(room.status, 'playing');
  assert.throws(() => manager.joinRoom(room.code, 'Newbie', 's3'), (err) => err.code === 'game_in_progress');
});

test('reconnect: same persistent playerId restores a disconnected player', () => {
  const manager = makeManager();
  const { room, player } = manager.createRoom('Ravi', 'sock-1');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.detachSocket('sock-1');
  assert.equal(player.connected, false);
  const { reconnected } = manager.joinRoom(room.code, 'Ravi', 'sock-1b', player.id);
  assert.equal(reconnected, true);
  assert.equal(player.connected, true);
  assert.equal(room.players.size, 2);
});

test('reconnect: same name with cleared storage adopts the disconnected player', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.detachSocket('sock-2');
  const { reconnected, player } = manager.joinRoom(room.code, '  sita ', 'sock-2b');
  assert.equal(reconnected, true);
  assert.equal(player.name, 'sita');
  assert.equal(room.players.size, 2);
});

test('disconnect: host leaves, another connected player becomes host', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const { player: sita } = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.detachSocket('sock-1');
  assert.equal(room.hostId, sita.id);
});

test('disconnect: mid-round host loss does not stall the game', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const { player: sita } = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  manager.detachSocket('sock-1');
  assert.equal(room.hostId, sita.id);
  assert.equal(room.status, 'playing');
  assert.deepEqual(manager.sanitize(room, sita.id).submitted, {});
});

test('empty room is cleaned up after the TTL', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.detachSocket('sock-1');
  manager.detachSocket('sock-2');
  assert.equal(room.emptySince !== null, true);
  manager.cleanupExpired(Date.now() + 5 * 60 * 1000);
  assert.equal(manager.getRoom(room.code), null);
});

test('setSettings: host only, clamps rounds and timer', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const sita = manager.joinRoom(room.code, 'Sita', 'sock-2');
  assert.throws(() => manager.setSettings(room.code, sita.player.id, { totalRounds: 5 }), (err) => err.code === 'not_host');
  manager.setSettings(room.code, room.hostId, { totalRounds: 999, timerSeconds: 9999 });
  assert.equal(room.totalRounds, 15);
  assert.equal(room.timerSeconds, 90);
  manager.setSettings(room.code, room.hostId, { totalRounds: 3, timerSeconds: 30 });
  assert.equal(room.totalRounds, 3);
  assert.equal(room.timerSeconds, 30);
});

test('startGame: host only and requires at least two connected players', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  assert.throws(() => manager.startGame(room.code, room.hostId), (err) => err.code === 'need_players');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  assert.equal(room.status, 'playing');
  assert.equal(room.roundNumber, 1);
  assert.match(room.letter, /^[A-Z]$/);
  assert.ok(room.deadline > Date.now());
  assert.ok(room.timeout, 'round deadline timeout scheduled');
  assert.deepEqual(manager.sanitize(room).submitted, {});
  // non-host cannot start
  const rooms = makeManager();
  const r2 = rooms.createRoom('A', 's1');
  rooms.joinRoom(r2.room.code, 'B', 's2');
  assert.throws(() => rooms.startGame(r2.room.code, 'some-id'), (err) => err.code === 'not_host');
});

test('submit: answers are cleaned to the four categories only', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const sita = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  manager.submit(room.code, room.hostId, { name: 'Ravi', place: ' ', animal: 'Rabbit', thing: 'Rope', food: 'Mango', score: 9999 });
  const sub = room.submissions.get(room.hostId);
  assert.deepEqual(Object.keys(sub).filter((k) => k !== 'submittedAt').sort(), ['animal', 'name', 'place', 'thing']);
  assert.equal(sub.food, undefined);
  assert.equal(sub.score, undefined);
  assert.equal(sub.place, '');
  assert.equal(sub.name, 'Ravi');
  assert.equal(manager.sanitize(room, sita.player.id).submitted[room.hostId], true);
});

test('submit: rejected after deadline is enforced by round completion', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  manager.completeRound(room.code); // simulate deadline firing
  assert.equal(room.status, 'results');
  assert.throws(() => manager.submit(room.code, room.hostId, { name: 'Ravi' }), (err) => err.code === 'bad_state');
});

test('submit: duplicates are blocked; all-submit completes the round automatically', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const sita = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  manager.submit(room.code, room.hostId, { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' });
  assert.throws(() => manager.submit(room.code, room.hostId, { name: 'Ravi' }), (err) => err.code === 'already_submitted');
  manager.submit(room.code, sita.player.id, { name: 'Ravi', place: 'Russia', animal: 'Rabbit', thing: 'Remote' });
  assert.equal(room.status, 'results', 'round completes when every connected player submits');
  const results = room.lastResults;
  const a = results.find((r) => r.playerId === room.hostId);
  const b = results.find((r) => r.playerId === sita.player.id);
  assert.equal(a.total, 30);
  assert.equal(b.total, 30);
  const players = [...room.players.values()];
  assert.equal(players.find((p) => p.id === room.hostId).score, 30);
  assert.equal(players.find((p) => p.id === sita.player.id).score, 30);
});

test('completeRound is idempotent and only scores once', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  manager.submit(room.code, room.hostId, { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' });
  manager.submit(room.code, [...room.players.keys()].find((id) => id !== room.hostId), { name: 'Rani', place: 'Russia', animal: 'Raven', thing: 'Remote' });
  manager.completeRound(room.code); // no-op (already completed via all-submit)
  manager.completeRound(room.code);
  const players = [...room.players.values()];
  assert.equal(players.find((p) => p.id === room.hostId).score, 40);
  assert.equal(room.roundLog.length, 1);
});

test('blank and invalid answers score zero through the manager', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const sita = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.startGame(room.code, room.hostId);
  manager.submit(room.code, room.hostId, { name: '', place: 'Rat', animal: 'Ravi', thing: 'Rope' });
  manager.submit(room.code, sita.player.id, { name: 'Rani', place: 'Russia', animal: 'Raven', thing: 'Remote' });
  const a = room.lastResults.find((r) => r.playerId === room.hostId);
  assert.equal(a.answers.name.code, 'blank');
  assert.equal(a.answers.name.points, 0);
  assert.equal(a.answers.place.valid, false); // Tiger is not a place
  assert.equal(a.answers.place.points, 0);
  assert.equal(a.total, 10); // only thing: 'Table' (unique) scores
});

test('game finishes after the configured number of rounds with a winner', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const sita = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.setSettings(room.code, room.hostId, { totalRounds: 2 });
  manager.startGame(room.code, room.hostId);
  manager.submit(room.code, room.hostId, { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' });
  manager.submit(room.code, sita.player.id, { name: 'Rani', place: 'Russia', animal: 'Raven', thing: 'Remote' });
  assert.equal(room.status, 'results');
  assert.equal(room.roundNumber, 1);
  manager.nextRound(room.code, room.hostId);
  assert.equal(room.status, 'playing');
  assert.equal(room.roundNumber, 2);
  manager.submit(room.code, room.hostId, { name: 'Ravi' });
  manager.submit(room.code, sita.player.id, { name: 'Rani', place: 'Russia', animal: 'Raven', thing: 'Remote' });
  assert.equal(room.status, 'finished');
  assert.equal(room.roundLog.length, 2);
  assert.equal(typeof room.winnerId, 'string');
  assert.equal(room.winnerId, sita.player.id);
  const states = manager.sanitize(room);
  assert.equal(states.status, 'finished');
  assert.ok(states.roundResults, 'finished state exposes final round results');
});

test('playAgain resets the room to the lobby', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  const sita = manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.setSettings(room.code, room.hostId, { totalRounds: 1 });
  manager.startGame(room.code, room.hostId);
  manager.submit(room.code, room.hostId, { name: 'Ravi', place: 'Chennai', animal: 'Tiger', thing: 'Table' });
  manager.submit(room.code, sita.player.id, { name: 'Sita', place: 'Mumbai', animal: 'Lion', thing: 'Chair' });
  assert.equal(room.status, 'finished');
  manager.playAgain(room.code, room.hostId);
  assert.equal(room.status, 'lobby');
  assert.equal(room.roundNumber, 0);
  assert.equal(room.winnerId, null);
  assert.equal([...room.players.values()][0].score, 0);
  assert.equal(room.players.size, 2);
});

test('leaveRoom removes a player and transfers hosts', () => {
  const manager = makeManager();
  const { room } = manager.createRoom('Ravi', 'sock-1');
  manager.joinRoom(room.code, 'Sita', 'sock-2');
  manager.leaveRoom('sock-1');
  assert.equal(room.players.size, 1);
  assert.equal([...room.players.values()][0].name, 'Sita');
  assert.equal(room.hostId, [...room.players.values()][0].id);
  manager.leaveRoom('sock-2');
  assert.equal(manager.getRoom(room.code), null, 'room deleted when empty');
});