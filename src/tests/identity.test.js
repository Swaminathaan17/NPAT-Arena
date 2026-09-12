import test from 'node:test';
import assert from 'node:assert/strict';
import { viewerIdFromState } from '../game/identity.js';

const stateWith = (players) => ({ code: 'AB7K2', hostId: players[0].id, players });

test('viewerIdFromState returns the id of the player flagged isYou', () => {
  const state = stateWith([
    { id: 'host-uuid', name: 'Ravi', isHost: true, isYou: true },
    { id: 'guest-uuid', name: 'Sita', isHost: false, isYou: false },
  ]);
  assert.equal(viewerIdFromState(state), 'host-uuid');
});

test('viewerIdFromState returns null when no player is flagged isYou', () => {
  const state = stateWith([
    { id: 'host-uuid', name: 'Ravi', isHost: true, isYou: false },
    { id: 'guest-uuid', name: 'Sita', isHost: false, isYou: false },
  ]);
  assert.equal(viewerIdFromState(state), null);
});

test('viewerIdFromState tolerates malformed or empty state', () => {
  assert.equal(viewerIdFromState(null), null);
  assert.equal(viewerIdFromState(undefined), null);
  assert.equal(viewerIdFromState({}), null);
  assert.equal(viewerIdFromState({ players: [] }), null);
  assert.equal(viewerIdFromState({ players: [{ id: '', isYou: true }] }), null);
});

test('viewerIdFromState finds the viewer regardless of player order', () => {
  const state = stateWith([
    { id: 'guest-uuid', name: 'Sita', isHost: false, isYou: false },
    { id: 'host-uuid', name: 'Ravi', isHost: true, isYou: true },
  ]);
  assert.equal(viewerIdFromState(state), 'host-uuid');
});