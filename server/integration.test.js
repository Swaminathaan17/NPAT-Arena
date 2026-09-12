import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createApp } from './app.js';

const LETTERS = ['A', 'B'];

async function boot() {
  const { server, app, close } = createApp({ pickLetter: () => LETTERS.shift() || 'A', corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'] });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { url: `http://127.0.0.1:${port}`, close };
}

function makeClient(url) {
  const socket = connect(url, { transports: ['websocket'], reconnection: false });
  const states = [];
  socket.on('room:state', (state) => states.push(state));
  const emit = (event, payload) => socket.timeout(4000).emitWithAck(event, payload);
  return {
    socket,
    states,
    emit,
    last: () => states[states.length - 1] || null,
    waitFor: (fn, timeout = 5000) => until(() => states.find(fn), timeout),
  };
}

async function until(fn, timeout = 5000) {
  const start = Date.now();
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const disconnect = (client) => { try { client.socket.disconnect(); } catch { /* noop */ } };

test('full multiplayer flow across simulated devices', async () => {
  const { url, close: closeServer } = await boot();
  const alice = makeClient(url);
  const bob = makeClient(url);
  const carol = makeClient(url);
  await Promise.all([
    until(() => alice.socket.connected),
    until(() => bob.socket.connected),
    until(() => carol.socket.connected),
  ]);

  try {
    // Device A creates a room.
    const created = await alice.emit('room:create', { name: 'Alice', playerId: 'pid-alice' });
    assert.equal(created.ok, true);
    const code = created.state.code;
    assert.match(code, /^[A-Z2-9]{5}$/);
    assert.equal(created.state.status, 'lobby');
    assert.equal(created.state.players.length, 1);

    // Device B joins with the room code.
    const joined = await bob.emit('room:join', { code, name: 'Bob', playerId: 'pid-bob' });
    assert.equal(joined.ok, true);

    // Both devices see a two-player lobby (creator is notified via broadcast).
    const lobbyA = await alice.waitFor((s) => s.players.length === 2);
    const lobbyB = await bob.waitFor((s) => s.players.length === 2);
    assert.equal(lobbyA.status, 'lobby');
    assert.equal(lobbyB.status, 'lobby');
    assert.deepEqual(new Set(lobbyA.players.map((p) => p.name)), new Set(['Alice', 'Bob']));
    assert.deepEqual(new Set(lobbyB.players.map((p) => p.name)), new Set(['Alice', 'Bob']));
    assert.equal(lobbyA.players.find((p) => p.isYou).name, 'Alice');
    assert.equal(lobbyB.players.find((p) => p.isYou).name, 'Bob');

    // Host configures a short game (2 rounds) so the test reaches the finished state.
    const settings = await alice.emit('room:settings', { code, totalRounds: 2, timerSeconds: 60 });
    assert.equal(settings.ok, true);

    // Only the host can start.
    const notHost = await bob.emit('room:start', { code });
    assert.equal(notHost.ok, false);
    assert.equal(notHost.error.code, 'not_host');

    // Invalid room code is rejected cleanly.
    const badJoin = await carol.emit('room:join', { code: 'ZZZZZ', name: 'Carol', playerId: 'pid-carol' });
    assert.equal(badJoin.ok, false);
    assert.equal(badJoin.error.code, 'not_found');

    // Duplicate names are rejected.
    const dupName = await carol.emit('room:join', { code, name: 'alice', playerId: 'pid-carol' });
    assert.equal(dupName.ok, false);
    assert.equal(dupName.error.code, 'name_taken');

    // Host starts the game; Alice is host.
    const started = await alice.emit('room:start', { code });
    assert.equal(started.ok, true);
    assert.equal(started.state.status, 'playing');
    assert.equal(started.state.roundNumber, 1);
    assert.equal(started.state.letter, 'A');

    // Both devices receive the same synchronized round state.
    const gameA = await alice.waitFor((s) => s.status === 'playing' && s.roundNumber === 1);
    const gameB = await bob.waitFor((s) => s.status === 'playing' && s.roundNumber === 1);
    assert.equal(gameA.letter, 'A');
    assert.equal(gameB.letter, 'A');
    assert.equal(gameA.deadline, gameB.deadline, 'timers must be server-synchronized');
    assert.ok(gameA.deadline > Date.now());

    // Answers must not be broadcast while playing.
    assert.equal(gameA.roundResults, null);

    // A non-player cannot submit.
    const rogue = await carol.emit('round:submit', { code, answers: { name: 'X', score: 9999 } });
    assert.equal(rogue.ok, false);
    assert.equal(rogue.error.code, 'not_in_room');

    // Client cannot inject scores — only known categories are accepted.
    const s1 = await alice.emit('round:submit', { code, answers: { name: 'Alice', place: 'Athens', animal: 'Ant', thing: 'Apple', score: 9999 } });
    assert.equal(s1.ok, true);
    const s2 = await bob.emit('round:submit', { code, answers: { name: 'Alice', place: 'Agra', animal: 'Ant', thing: 'Anchor', score: 9999 } });
    assert.equal(s2.ok, true);

    // Round completes automatically when everyone has submitted.
    const resultsA = await alice.waitFor((s) => s.status === 'results' && s.roundNumber === 1);
    const resultsB = await bob.waitFor((s) => s.status === 'results' && s.roundNumber === 1);
    assert.equal(resultsA.roundNumber, resultsB.roundNumber);
    assert.equal(resultsA.winnerId ?? null, resultsB.winnerId ?? null);
    const byId = Object.fromEntries(resultsA.roundResults.map((r) => [r.playerId, r]));
    const aliceIds = resultsB.players.filter((p) => p.name === 'Alice').map((p) => p.id);
    const bobR = byId[resultsB.players.find((p) => p.name === 'Bob').id];
    assert.equal(byId[aliceIds[0]].answers.name.points, 5);
    assert.equal(byId[aliceIds[0]].answers.place.points, 10);
    assert.equal(byId[aliceIds[0]].answers.animal.points, 5);
    assert.equal(byId[aliceIds[0]].answers.thing.points, 10);
    assert.equal(byId[aliceIds[0]].total, 30);
    assert.equal(bobR.total, 30);

    // Host starts round two.
    const r2 = await alice.emit('round:next', { code });
    assert.equal(r2.ok, true);
    assert.equal(r2.state.roundNumber, 2);
    assert.equal(r2.state.letter, 'B');
    await until(() => bob.states.some((s) => s.status === 'playing' && s.roundNumber === 2));

    const s3 = await alice.emit('round:submit', { code, answers: { name: 'Ben', place: 'Berlin', animal: 'Bat', thing: '' } });
    assert.equal(s3.ok, true);
    const s4 = await bob.emit('round:submit', { code, answers: { name: 'Ben', place: 'Boston', animal: 'Bat', thing: 'Ball' } });
    assert.equal(s4.ok, true);

    // Final leaderboard is synchronized; Bob wins.
    const finalA = await alice.waitFor((s) => s.status === 'finished');
    const finalB = await bob.waitFor((s) => s.status === 'finished');
    assert.equal(finalA.winnerId ?? null, finalB.winnerId ?? null, 'winner must match across clients');
    const aliceFinal = finalB.players.find((p) => p.name === 'Alice');
    const bobFinal = finalB.players.find((p) => p.name === 'Bob');
    assert.equal(aliceFinal.score, 50);
    assert.equal(bobFinal.score, 60);
    assert.equal(finalB.winnerId, bobFinal.id);
    assert.ok(finalB.roundResults);

    // Host can play again; room resets together.
    const again = await alice.emit('room:playAgain', { code });
    assert.equal(again.ok, true);
    assert.equal(again.state.status, 'lobby');
    await until(() => bob.states.some((s) => s.status === 'lobby'));
    const lobbyAfterAgain = bob.states.find((s) => s.status === 'lobby');
    assert.equal(lobbyAfterAgain.players.every((p) => p.score === 0), true);

    // Host disconnect transfers host to a connected player mid-game.
    await alice.emit('room:start', { code });
    await until(() => bob.states.some((s) => s.status === 'playing'));
    alice.socket.disconnect();
    const transferred = await until(() => bob.states.find((s) => {
      const aliceP = s.players.find((p) => p.name === 'Alice');
      const bobP = s.players.find((p) => p.name === 'Bob');
      return aliceP && !aliceP.connected && bobP && bobP.connected;
    }));
    assert.equal(transferred.hostId, bob.last().players.find((p) => p.name === 'Bob').id);
  } finally {
    disconnect(alice); disconnect(bob); disconnect(carol);
    closeServer();
  }
});

test('health endpoint responds', async () => {
  const { url, close } = await boot();
  try {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    close();
  }
});