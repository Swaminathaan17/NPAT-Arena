import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CATEGORY_KEYS } from '../game/categories.js';
import { canonicalize, duplicateKey, validateAnswer } from '../game/validation.js';
import { LETTERS, maxRoundScore, randomLetter, scoreRound } from '../game/scoring.js';

test('exactly four categories: Name, Place, Animal, Thing', () => {
  assert.deepEqual(CATEGORY_KEYS, ['name', 'place', 'animal', 'thing']);
  assert.deepEqual(CATEGORIES.map((c) => c.label), ['Name', 'Place', 'Animal', 'Thing']);
  assert.equal(maxRoundScore(), 40);
});

test('canonicalize normalizes case, whitespace, accents and punctuation', () => {
  assert.equal(canonicalize('  TIGER  '), 'tiger');
  assert.equal(canonicalize(' NÉw...   York  '), 'new york');
  assert.equal(canonicalize('U.S.A.'), 'usa');
});

test('duplicateKey collapses plurals and simple variants', () => {
  assert.equal(duplicateKey('Tiger'), 'tiger');
  assert.equal(duplicateKey('tigers'), 'tiger');
  assert.equal(duplicateKey('  TIGERS '), 'tiger');
});

test('validates valid answers across the four categories', () => {
  const cases = [
    ['T', 'name', 'Thomas'],
    ['C', 'place', 'Chennai'],
    ['T', 'animal', 'Tiger'],
    ['T', 'thing', 'Table'],
    ['A', 'animal', 'Alpaca'],
    ['B', 'place', 'Berlin'],
    ['K', 'name', 'Karthik'],
    ['Z', 'thing', 'Zipper'],
    ['V', 'place', 'Vancouver'],
  ];
  cases.forEach(([letter, category, value]) => assert.equal(validateAnswer(value, category, letter).valid, true, `${value} should be a valid ${category} starting with ${letter}`));
});

test('rejects wrong starting letter', () => {
  const result = validateAnswer('Ravi', 'name', 'T');
  assert.equal(result.valid, false);
  assert.equal(result.code, 'wrong-letter');
  assert.match(result.reason, /start with T/i);
});

test('rejects blank answers', () => {
  const result = validateAnswer('   ', 'thing', 'T');
  assert.equal(result.valid, false);
  assert.equal(result.code, 'blank');
});

test('rejects answers that do not belong to the category', () => {
  assert.equal(validateAnswer('Tiger', 'name', 'T').valid, false);
  assert.equal(validateAnswer('Chennai', 'animal', 'C').valid, false);
  assert.equal(validateAnswer('Ravi', 'place', 'R').valid, false);
  assert.equal(validateAnswer('Table', 'animal', 'T').valid, false);
});

test('food, drink and job are no longer categories and are rejected', () => {
  assert.equal(validateAnswer('Mango', 'food', 'M').valid, false);
  assert.equal(validateAnswer('Milk', 'drink', 'M').valid, false);
  assert.equal(validateAnswer('Doctor', 'profession', 'D').valid, false);
  assert.ok(!CATEGORY_KEYS.includes('food'));
  assert.ok(!CATEGORY_KEYS.includes('drink'));
  assert.ok(!CATEGORY_KEYS.includes('profession'));
});

test('scoring: unique valid answer = 10 across all four categories', () => {
  const players = [{ id: 'a', name: 'A' }];
  const submissions = { a: { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' } };
  const results = scoreRound({ players, submissions, letter: 'R' });
  const a = results[0].answers;
  assert.equal(a.name.points, 10);
  assert.equal(a.place.points, 10);
  assert.equal(a.animal.points, 10);
  assert.equal(a.thing.points, 10);
  assert.equal(results[0].total, 40);
});

test('scoring: unique 10, duplicate 5, per category independently', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const submissions = {
    a: { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rug' },
    b: { name: 'Ravi', place: 'Russia', animal: 'Rabbit', thing: 'Rope' },
  };
  const results = scoreRound({ players, submissions, letter: 'R' });
  const a = results.find((r) => r.playerId === 'a').answers;
  const b = results.find((r) => r.playerId === 'b').answers;
  assert.equal(a.name.points, 5); // duplicated
  assert.equal(b.name.points, 5);
  assert.equal(a.place.points, 10); // unique
  assert.equal(b.place.points, 10);
  assert.equal(a.animal.points, 5); // duplicated
  assert.equal(b.animal.points, 5);
  assert.equal(a.thing.points, 10); // unique
  assert.equal(b.thing.points, 10);
  assert.equal(results.find((r) => r.playerId === 'a').total, 30);
  assert.equal(results.find((r) => r.playerId === 'b').total, 30);
});

test('duplicates are scoped to their category', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const submissions = {
    a: { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' },
    b: { name: 'Rani', place: 'Rome', animal: 'Raven', thing: 'Remote' },
  };
  const results = scoreRound({ players, submissions, letter: 'R' });
  const byId = Object.fromEntries(results.map((r) => [r.playerId, r]));
  assert.equal(byId.a.answers.name.points, 10);
  assert.equal(byId.a.answers.place.points, 5); // shared place is a duplicate
  assert.equal(byId.a.answers.animal.points, 10); // unaffected by the place duplicate
  assert.equal(byId.a.answers.thing.points, 10);
  assert.equal(byId.a.total, 35);
  assert.equal(byId.b.total, 35);
});

test('normalized duplicates share points', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const submissions = { a: { animal: 'Rabbit' }, b: { animal: ' RABBIT ' } };
  const results = scoreRound({ players, submissions, letter: 'R' });
  assert.deepEqual(results.map((r) => r.answers.animal.points), [5, 5]);
});

test('blank, invalid and wrong-letter answers score 0', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const submissions = {
    a: { name: 'Ravi', place: '', animal: 'Ravi', thing: 'Sofa' },
    b: { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Remote' },
  };
  const results = scoreRound({ players, submissions, letter: 'R' });
  const a = results.find((r) => r.playerId === 'a').answers;
  assert.equal(a.name.points, 5); // duplicated with b
  assert.equal(a.place.code, 'blank');
  assert.equal(a.place.points, 0);
  assert.equal(a.animal.code, 'invalid'); // Ravi is a name, not an animal
  assert.equal(a.animal.points, 0);
  assert.equal(a.thing.code, 'wrong-letter'); // Sofa does not start with R
  assert.equal(a.thing.points, 0);
  assert.equal(results.find((r) => r.playerId === 'a').total, 5);
  // b: name dup 5 + place unique 10 + animal unique 10 + thing unique 10 = 35
  assert.equal(results.find((r) => r.playerId === 'b').total, 35);
});

test('wrong starting letter scores 0 even if otherwise valid', () => {
  const players = [{ id: 'a', name: 'A' }];
  const submissions = { a: { animal: 'Rabbit' } };
  const results = scoreRound({ players, submissions, letter: 'K' });
  assert.equal(results[0].answers.animal.points, 0);
  assert.equal(results[0].answers.animal.code, 'wrong-letter');
  assert.equal(results[0].total, 0);
});

test('invalid answers never receive duplicate points', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const submissions = { a: { place: 'Rat' }, b: { place: 'Rat' } };
  const results = scoreRound({ players, submissions, letter: 'R' });
  // Rat is an animal, not a place → invalid for both → both 0, not 5.
  assert.equal(results[0].answers.place.points, 0);
  assert.equal(results[0].answers.place.valid, false);
  assert.equal(results[1].answers.place.points, 0);
  assert.equal(results[1].answers.place.valid, false);
});

test('maximum round score is 40 (4 × 10)', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const submissions = { a: { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' }, b: { name: 'Rani', place: 'Russia', animal: 'Raven', thing: 'Remote' } };
  const results = scoreRound({ players, submissions, letter: 'R' });
  assert.equal(results[0].total, 40);
  assert.equal(results[1].total, 40);
});

test('randomLetter returns a fresh letter avoiding used ones where possible', () => {
  const used = 'ABCDEFGHIJKLMNOPQSTUVWXYZ'.split('');
  const letter = randomLetter(used);
  assert.ok(letter);
  assert.ok(!used.includes(letter), 'should avoid used letters when possible');
  // when all 26 are used, it falls back to any letter
  const letter2 = randomLetter(LETTERS);
  assert.ok(LETTERS.includes(letter2));
});

test('scoring is pure and idempotent', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const submissions = {
    a: { name: 'Ravi', place: 'Rome', animal: 'Rabbit', thing: 'Rope' },
    b: { name: 'Ravi', place: 'Russia', animal: 'Rabbit', thing: 'Remote' },
    c: { name: 'Ria', place: 'Rajasthan', animal: 'Raven', thing: 'Ring' },
  };
  const first = scoreRound({ players, submissions, letter: 'R' });
  const second = scoreRound({ players, submissions, letter: 'R' });
  assert.deepEqual(first, second);
});