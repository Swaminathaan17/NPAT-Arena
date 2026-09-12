import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, evaluateCareer, mergeAchievements } from './achievements.js';

test('achievements list is 9 unique entries with display metadata', () => {
  assert.equal(ACHIEVEMENTS.length, 9);
  const keys = new Set(ACHIEVEMENTS.map((a) => a.key));
  assert.equal(keys.size, 9);
  ACHIEVEMENTS.forEach((a) => {
    assert.equal(typeof a.name, 'string');
    assert.equal(typeof a.detail, 'string');
    assert.ok(a.icon, `icon missing for ${a.key}`);
  });
});

test('evaluateCareer honors each threshold (and boundaries)', () => {
  assert.deepEqual(evaluateCareer(null), []);
  assert.deepEqual(evaluateCareer('nope'), []);
  assert.deepEqual(evaluateCareer({}), []);
  assert.deepEqual(evaluateCareer({ wins: 0 }), []);

  assert.ok(evaluateCareer({ wins: 1 }).includes('firstWin'));
  assert.ok(evaluateCareer({ perfectRounds: 1 }).includes('perfectRound'));
  assert.ok(evaluateCareer({ fastest: 8 }).includes('speedDemon'));
  assert.ok(!evaluateCareer({ fastest: 8.1 }).includes('speedDemon'));
  assert.ok(!evaluateCareer({ uniqueCount: 9 }).includes('uniqueMind'));
  assert.ok(evaluateCareer({ uniqueCount: 10 }).includes('uniqueMind'));
  assert.ok(!evaluateCareer({ bestStreak: 2 }).includes('streakMaster'));
  assert.ok(evaluateCareer({ bestStreak: 3 }).includes('streakMaster'));
  assert.ok(!evaluateCareer({ challenges: { won: 1 } }).includes('challengeKing'));
  assert.ok(evaluateCareer({ challenges: { won: 2 } }).includes('challengeKing'));
  assert.ok(!evaluateCareer({ hardLetterWins: 0 }).includes('letterSurvivor'));
  assert.ok(evaluateCareer({ hardLetterWins: 1 }).includes('letterSurvivor'));
  assert.ok(evaluateCareer({ games: 2, winRate: 100 }).includes('consistent') === false);
  assert.ok(evaluateCareer({ games: 3, winRate: 59 }).includes('consistent') === false);
  assert.ok(evaluateCareer({ games: 3, winRate: 60 }).includes('consistent'));
  assert.ok(evaluateCareer({ comebacks: 1 }).includes('comeback'));
});

test('mergeAchievements stores once, reports only new unlocks', () => {
  const career = [
    { key: 'Alice', name: 'Alice', wins: 1, bestStreak: 3, fastest: 5 },
    { key: 'Bob', name: 'Bob', comebacks: 1, hardLetterWins: 1 },
  ];
  const t = new Date('2026-01-01T00:00:00Z');
  const first = mergeAchievements(career, {}, { now: t });
  assert.equal(first.newlyUnlocked.length, 5);
  assert.equal(first.stored['alice'].firstWin, '2026-01-01T00:00:00.000Z');
  assert.ok(first.stored['alice'].speedDemon);
  assert.ok(first.stored['alice'].streakMaster);
  assert.ok(first.stored['bob'].comeback);
  assert.ok(first.stored['bob'].letterSurvivor);
  assert.ok(first.newlyUnlocked.some((u) => u.playerKey === 'alice' && u.key === 'firstWin'));

  const tLater = new Date('2026-02-02T00:00:00Z');
  const second = mergeAchievements(career, first.stored, { now: tLater });
  assert.equal(second.newlyUnlocked.length, 0);
  assert.deepEqual(second.stored, first.stored);
});

test('mergeAchievements keys are case-insensitive and tolerant of bad storage', () => {
  const t = new Date('2026-01-01T00:00:00Z');
  const r = mergeAchievements([{ key: 'ALICE', name: 'Alice', wins: 1 }], 'garbage', { now: t });
  assert.equal(r.newlyUnlocked.length, 1);
  assert.equal(r.newlyUnlocked[0].playerKey, 'alice');
  assert.ok(r.stored['alice'].firstWin);
});

test('mergeAchievements never stores achievements for players without criteria', () => {
  const t = new Date('2026-01-01T00:00:00Z');
  const r = mergeAchievements([{ key: 'Newbie', name: 'Newbie', wins: 0 }], { newbie: { firstWin: '2026-01-01T00:00:00.000Z' } }, { now: t });
  assert.equal(r.newlyUnlocked.length, 0);
  assert.deepEqual(r.stored, { newbie: { firstWin: '2026-01-01T00:00:00.000Z' } });
});