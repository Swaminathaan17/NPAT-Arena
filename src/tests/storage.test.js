import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, load, loadSettings, remove, save } from '../utils/storage.js';

test('storage ops recover gracefully in environments without localStorage', () => {
  assert.equal(load('missing-key', 'fb'), 'fb');
  assert.equal(save('k', { a: 1 }), false);
  assert.doesNotThrow(() => remove('k'));
  assert.equal(loadSettings('fallback'), 'fallback');
});

test('load recovers from malformed stored JSON without crashing', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  store.set(KEYS.SETTINGS, '{not json');
  store.set(KEYS.HISTORY, '["partially');
  assert.equal(load(KEYS.SETTINGS, 'def'), 'def');
  assert.deepEqual(load(KEYS.HISTORY, []), []);
  delete globalThis.localStorage;
});