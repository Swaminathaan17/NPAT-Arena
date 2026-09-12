import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHighlights, scoreExplanation, scoreRound, standingsAfter, suddenDeathEnd } from '../game/game.js';
import { computeCareerStats, computeStats, mergePlayerStats, recordGame } from '../game/stats.js';

test('suddenDeathEnd: survivor, lone survivor regardless of caps, mass tie, empty', () => {
  assert.deepEqual(suddenDeathEnd(['a']), { finished: true, survivorId: 'a' });
  assert.deepEqual(suddenDeathEnd(['a', 'b']), { finished: false, survivorId: null });
  assert.deepEqual(suddenDeathEnd([]), { finished: true, survivorId: null });
  assert.deepEqual(suddenDeathEnd(), { finished: true, survivorId: null });
});

test('standingsAfter sums cumulatively and breaks ties by id', () => {
  const log = [
    { results: [{ playerId: 'a', total: 10 }, { playerId: 'b', total: 30 }] },
    { results: [{ playerId: 'a', total: 50 }, { playerId: 'b', total: 10 }] },
  ];
  assert.deepEqual(standingsAfter(log, 1), [{ playerId: 'b', score: 30 }, { playerId: 'a', score: 10 }]);
  assert.deepEqual(standingsAfter(log), [{ playerId: 'a', score: 60 }, { playerId: 'b', score: 40 }]);
  assert.deepEqual(standingsAfter([], 0), []);
  assert.deepEqual(standingsAfter(log, 99), standingsAfter(log));
  assert.deepEqual(standingsAfter(log, -1), []);
});

test('standingsAfter accepts stored perRound shape (players key)', () => {
  const log = [
    { players: [{ playerId: 'a', total: 5 }, { playerId: 'b', total: 5 }] },
  ];
  assert.deepEqual(standingsAfter(log, 1), [
    { playerId: 'a', score: 5 },
    { playerId: 'b', score: 5 },
  ]);
});

test('scoreExplanation sums back to the scored answer points', () => {
  const r = scoreRound({
    players: [{ id: 'a' }, { id: 'b' }],
    answers: { a: { thing: 'Guitar' }, b: { thing: 'Gun' } },
    letter: 'G',
    duplicatesAllowed: false,
    profile: 'intense',
    timings: { a: 10 },
    timer: 60,
    streaks: { a: 1 },
  });
  const ans = r[0].answers.thing;
  const exp = scoreExplanation(ans);
  assert.equal(exp.total, ans.points);
  assert.ok(exp.parts.length >= 1);
  assert.equal(exp.parts.reduce((s, p) => s + p.value, 0), exp.total);
  assert.ok(exp.parts.some((p) => p.label === 'Base'));
});

test('scoreExplanation is empty-safe', () => {
  assert.deepEqual(scoreExplanation({}), { parts: [], total: 0 });
  assert.deepEqual(scoreExplanation(), { parts: [], total: 0 });
});

test('computeHighlights: empty game yields no highlights; populated game is deterministic', () => {
  assert.deepEqual(computeHighlights({}), []);
  assert.deepEqual(computeHighlights({ players: [], roundLog: [] }), []);

  const game = {
    players: [
      { id: 'a', name: 'Alice', streak: 2 },
      { id: 'b', name: 'Bob', streak: 0 },
    ],
    survivorId: 'a',
    roundLog: [
      { round: 1, letter: 'B', winnerId: 'b', timings: { a: 5, b: 30 }, results: [
        { playerId: 'a', total: 20, answers: { place: { points: 10, unique: 2, challenged: false } } },
        { playerId: 'b', total: 40, answers: { place: { points: 10, unique: 0 } } },
      ]},
      { round: 2, letter: 'J', winnerId: 'a', timings: { a: 9, b: 15 }, results: [
        { playerId: 'a', total: 80, answers: { thing: { points: 10, challenged: true } } },
        { playerId: 'b', total: 0, answers: {} },
      ]},
    ],
  };
  const a = computeHighlights(game);
  const b = computeHighlights(game);
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((h) => h.key), ['fastest', 'biggest', 'comeback', 'streak', 'unique', 'challenge', 'toughLetter']);
  assert.equal(a.find((h) => h.key === 'fastest').value, 5);
  assert.equal(a.find((h) => h.key === 'fastest').name, 'Alice');
  assert.equal(a.find((h) => h.key === 'biggest').playerId, 'a');
  assert.equal(a.find((h) => h.key === 'comeback').playerId, 'a');
  assert.equal(a.find((h) => h.key === 'streak').value, 2);
  assert.equal(a.find((h) => h.key === 'unique').playerId, 'a');
  assert.equal(a.find((h) => h.key === 'challenge').playerId, 'a');
  assert.equal(a.find((h) => h.key === 'toughLetter').value, 'J');
});

test('computeHighlights: no comeback when a winner leads wire-to-wire', () => {
  const game = {
    players: [
      { id: 'a', name: 'Alice', streak: 0 },
      { id: 'b', name: 'Bob', streak: 0 },
    ],
    roundLog: [
      { round: 1, letter: 'A', winnerId: 'a', timings: { a: 40, b: 30 }, results: [
        { playerId: 'a', total: 50, answers: { place: { points: 10 } } },
        { playerId: 'b', total: 30, answers: { place: { points: 10 } } },
      ]},
    ],
  };
  const keys = computeHighlights(game).map((h) => h.key);
  assert.ok(!keys.includes('comeback'));
});

test('recordGame: hardens malformed input, stores duration and elimination order', () => {
  const entry = recordGame(null, {}, { durationSec: 42 })[0];
  assert.ok(entry.id && entry.date);
  assert.equal(entry.mode, 'classic');
  assert.deepEqual(entry.players, []);
  assert.equal(entry.winnerId, null);
  assert.deepEqual(entry.perRound, []);
  assert.deepEqual(entry.eliminatedOrder, []);
  assert.equal(entry.durationSec, 42);

  const players = [
    { id: 'a', name: 'Alice', color: '#111', score: 60, streak: 2 },
    { id: 'b', name: 'Bob', color: '#222', score: 40, streak: 0 },
  ];
  const roundLog = [
    { round: 1, letter: 'A', dead: [], winnerId: 'b', timings: { a: 3, b: 40 }, results: [
      { playerId: 'a', total: 10, answers: { place: { points: 10 } } },
      { playerId: 'b', total: 30, answers: { place: { points: 5 } } },
    ]},
    { round: 2, letter: 'J', dead: ['b'], winnerId: 'a', timings: { a: 9 }, results: [
      { playerId: 'a', total: 50, answers: { thing: { points: 10 } } },
      { playerId: 'b', total: 10, answers: {} },
    ]},
  ];
  const stored = recordGame(['old'], { players, roundLog, settings: { mode: 'sudden-death', theme: 'foodie', rounds: 2, timer: 60, playerCount: 2 } }, { durationSec: 90 });
  assert.equal(stored.length, 2);
  const e = stored[0];
  assert.equal(e.winnerId, 'a');
  assert.equal(e.theme, 'foodie');
  assert.equal(e.mode, 'sudden-death');
  assert.equal(e.durationSec, 90);
  assert.deepEqual(e.eliminatedOrder, ['b']);
  assert.equal(e.perRound.length, 2);
  assert.equal(e.perRound[0].players[0].timeUsed, 3);
  assert.equal(e.perRound[1].players[0].timeUsed, 9);
});

test('recordGame: mass sudden-death tie records no winner', () => {
  const game = { players: [{ id: 'a', name: 'Alice', score: 0 }, { id: 'b', name: 'Bob', score: 0 }], mode: 'sudden-death', roundLog: [] };
  const entry = recordGame([], game)[0];
  assert.equal(entry.winnerId, null);
  assert.equal(entry.perRound.length, 0);
});

test('computeStats: hardLetterWins and comebacks from stored history', () => {
  const players = [
    { id: 'a', name: 'Alice', color: '#111', score: 60, streak: 2 },
    { id: 'b', name: 'Bob', color: '#222', score: 40, streak: 0 },
  ];
  const roundLog = [
    { round: 1, letter: 'A', dead: [], winnerId: 'b', timings: { a: 3, b: 40 }, results: [
      { playerId: 'a', total: 10, answers: { place: { points: 10 } } },
      { playerId: 'b', total: 30, answers: { place: { points: 5 } } },
    ]},
    { round: 2, letter: 'J', dead: ['b'], winnerId: 'a', timings: { a: 9 }, results: [
      { playerId: 'a', total: 50, answers: { thing: { points: 10 } } },
      { playerId: 'b', total: 10, answers: {} },
    ]},
  ];
  const history = recordGame([], { players, roundLog })[0];
  const stats = computeStats([history]);
  const alice = stats.players.find((p) => p.id === 'a');
  const bob = stats.players.find((p) => p.id === 'b');
  assert.equal(alice.hardLetterWins, 1);
  assert.equal(bob.hardLetterWins, 0);
  assert.equal(alice.comebacks, 1);
  assert.equal(alice.fastest, 3);
  assert.equal(alice.bestRound, 50);
  assert.equal(alice.perfectRounds, 2);
  assert.equal(bob.perfectRounds, 1);
  assert.deepEqual(stats.players.map((p) => p.id), ['a', 'b']);
});

test('computeStats is deterministic across calls', () => {
  const players = [{ id: 'a', name: 'Alice', score: 10 }, { id: 'b', name: 'Bob', score: 5 }];
  const history = recordGame([], { players, roundLog: [] });
  assert.equal(JSON.stringify(computeStats(history)), JSON.stringify(computeStats(history)));
});

test('mergePlayerStats merges same-name players across ids and recomputes rates', () => {
  const merged = mergePlayerStats([
    { name: 'Alice', id: 'x', games: 1, wins: 1, points: 100, bestScore: 100, bestRound: 30, bestStreak: 2, fastest: 5, perfectRounds: 1, totalRounds: 2, uniqueCount: 4, challenges: { tried: 1, won: 1 }, hardLetterWins: 1, comebacks: 1, categories: { place: { answered: 1, scored: 1 } }, letters: { A: { answered: 1, scored: 1 } }, form: [{ win: true, score: 100, date: '2026-01-01', id: 'g1' }] },
    { name: 'alice ', id: 'y', games: 1, wins: 0, points: 80, bestScore: 80, bestRound: 10, bestStreak: 1, fastest: 9, perfectRounds: 0, totalRounds: 1, uniqueCount: 1, challenges: { tried: 1, won: 0 }, hardLetterWins: 0, comebacks: 0, categories: { thing: { answered: 1, scored: 1 } }, letters: { J: { answered: 1, scored: 1 } }, form: [{ win: false, score: 80, date: '2026-02-01', id: 'g2' }] },
  ]);
  assert.equal(merged.length, 1);
  const alice = merged[0];
  assert.equal(alice.key, 'alice');
  assert.equal(alice.id, 'alice');
  assert.equal(alice.games, 2);
  assert.equal(alice.wins, 1);
  assert.equal(alice.points, 180);
  assert.equal(alice.bestScore, 100);
  assert.equal(alice.bestStreak, 2);
  assert.equal(alice.fastest, 5);
  assert.equal(alice.perfectRounds, 1);
  assert.equal(alice.totalRounds, 3);
  assert.equal(alice.uniqueCount, 5);
  assert.equal(alice.hardLetterWins, 1);
  assert.equal(alice.comebacks, 1);
  assert.equal(alice.winRate, 50);
  assert.equal(alice.avgScore, 90);
  assert.equal(alice.avgRound, 60);
  assert.equal(alice.perfectRate, 33);
  assert.equal(alice.challenges.won, 1);
  assert.equal(alice.categories.place.scored, 1);
  assert.equal(alice.categories.thing.scored, 1);
  assert.equal(alice.letters.A.scored, 1);
  assert.equal(alice.letters.J.scored, 1);
  assert.equal(alice.form.length, 2);
  assert.equal(alice.form[0].id, 'g2');
});

test('computeCareerStats exposes winRate/bestLetter for a won game', () => {
  const players = [
    { id: 'a', name: 'Alice', color: '#111', score: 60, streak: 1 },
    { id: 'b', name: 'Bob', color: '#222', score: 40, streak: 0 },
  ];
  const roundLog = [
    { round: 1, letter: 'M', dead: [], winnerId: 'a', timings: { a: 6, b: 30 }, results: [
      { playerId: 'a', total: 30, answers: { food: { value: 'Mango', points: 10 }, drink: { value: 'Milk', points: 10 } } },
      { playerId: 'b', total: 25, answers: { food: { value: 'Muffin', points: 5 } } },
    ]},
    { round: 2, letter: 'M', dead: [], winnerId: 'a', timings: { a: 7, b: 31 }, results: [
      { playerId: 'a', total: 30, answers: { food: { value: 'Melon', points: 10 }, drink: { value: 'Mojito', points: 10 } } },
      { playerId: 'b', total: 25, answers: { food: { value: 'Muesli', points: 5 } } },
    ]},
  ];
  const history = recordGame([], { players, roundLog });
  const career = computeCareerStats(history);
  assert.equal(career.length, 2);
  const alice = career.find((p) => p.key === 'alice');
  assert.equal(alice.wins, 1);
  assert.equal(alice.games, 1);
  assert.equal(alice.winRate, 100);
  assert.equal(alice.bestLetter, 'M');
  assert.equal(alice.perfectRate, 100);
});