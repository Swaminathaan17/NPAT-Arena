import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, MODES, clampInt, getCategories, roundWinnerId, sanitizeSettings, scoreRound } from './game.js';
import { canonicalize, validateAnswer } from './validation.js';
import { computeStats, recordGame } from './stats.js';

test('normalizes case whitespace accents and punctuation', () => { assert.equal(canonicalize('  NÉw...   York  '), 'new york'); assert.equal(canonicalize('U.S.A.'), 'usa'); });
test('accepts valid answers across multiple letters and categories', () => { [['A','animal','Alpaca'],['B','place','Berlin'],['K','name','Karthik'],['Z','thing','Zipper']].forEach(([l,c,a]) => assert.equal(validateAnswer(a,c,l).valid,true)); });
test('accepts less-common vocabulary and plural animals', () => { assert.equal(validateAnswer('Wombats','animal','W').valid,true); assert.equal(validateAnswer('Rhinoceros','animal','R').valid,true); assert.equal(validateAnswer('Vancouver','place','V').valid,true); });
test('allows reasonable unknown names and place suffixes', () => { assert.equal(validateAnswer('Xavier','name','X').valid,true); assert.equal(validateAnswer('Zanzibar City','place','Z').valid,true); });
test('rejects wrong letters and empty answers', () => { assert.match(validateAnswer('Tiger','animal','K').reason,/start with K/i); assert.match(validateAnswer(' ','thing','T').reason,/enter an answer/i); });
test('detects category conflicts clearly', () => { assert.match(validateAnswer('Delhi','animal','D').reason,/place/i); assert.match(validateAnswer('Giraffe','thing','G').reason,/animal/i); assert.match(validateAnswer('Alice','place','A').reason,/name/i); });
test('detects normalized duplicates while retaining phase one points', () => { const players=[{id:'one'},{id:'two'}]; const answers={one:{animal:' Dogs '},two:{animal:'dog'}}; const noDuplicates=scoreRound({players,answers,letter:'D',duplicatesAllowed:false}); const allowed=scoreRound({players,answers,letter:'D',duplicatesAllowed:true}); assert.deepEqual(noDuplicates.map(r=>r.answers.animal.points),[5,5]); assert.deepEqual(allowed.map(r=>r.answers.animal.points),[10,10]); });
test('validates the new theme categories', () => { assert.equal(validateAnswer('Burrito','food','B').valid,true); assert.equal(validateAnswer('Fries','food','F').valid,true); assert.equal(validateAnswer('Lemonade','drink','L').valid,true); assert.equal(validateAnswer('Milk','drink','M').valid,true); assert.equal(validateAnswer('Electrician','profession','E').valid,true); assert.equal(validateAnswer('Barber','profession','B').valid,true); });
test('applies theme aliases and plausible heuristics', () => { assert.equal(validateAnswer('Coke','drink','C').valid,true); assert.equal(validateAnswer('Pizza Pie','food','P').valid,true); assert.equal(validateAnswer('Pilots','profession','P').valid,true); });
test('resolves theme category sets', () => { assert.deepEqual(getCategories('foodie').map((c)=>c.key),['food','drink','place','thing']); assert.deepEqual(getCategories('career').map((c)=>c.key),['profession','place','animal','thing']); assert.equal(getCategories('classic').length,4); assert.equal(getCategories('missing-theme').length,4); });
test('scoring respects the selected theme', () => { const players=[{id:'one'}]; const classicAnswers={one:{name:'Mia',place:'Madrid',animal:'Moose',thing:'Mic'}}; const classic=scoreRound({players,answers:classicAnswers,letter:'M',duplicatesAllowed:true,categories:getCategories('classic')}); assert.equal(classic[0].total,40); const foodieAnswers={one:{food:'Mango',drink:'Milk',place:'Madrid',thing:'Mic'}}; const foodie=scoreRound({players,answers:foodieAnswers,letter:'M',duplicatesAllowed:true,categories:getCategories('foodie')}); assert.equal(foodie[0].total,41); const classicOnFoodie=scoreRound({players,answers:foodieAnswers,letter:'M',duplicatesAllowed:true,categories:getCategories('classic')}); assert.equal(classicOnFoodie[0].total,20); });
test('adjudication overrides force unrecognized answers valid and integrate duplicates', () => { const players=[{id:'one'},{id:'two'}]; const answers={one:{place:'Gizmo'},two:{place:'Gizmer'}}; const overrides={place:{gizmo:true}}; const r=scoreRound({players,answers,letter:'G',duplicatesAllowed:false,overrides}); assert.equal(r[0].answers.place.valid,true); assert.equal(r[0].answers.place.challenged,true); assert.equal(r[0].answers.place.points,12); assert.equal(r[1].answers.place.valid,false); });
test('adjudication does not force wrong-letter or empty answers', () => { const players=[{id:'one'}]; const wrong=scoreRound({players,answers:{one:{thing:'apple'}},letter:'B',duplicatesAllowed:false,overrides:{thing:{apple:true}}}); assert.equal(wrong[0].answers.thing.valid,false); const empty=scoreRound({players,answers:{one:{thing:''}},letter:'A',duplicatesAllowed:false,overrides:{thing:{'':true}}}); assert.equal(empty[0].answers.thing.valid,false); });
test('upheld duplicates share points when duplicates are disallowed', () => { const players=[{id:'one'},{id:'two'}]; const answers={one:{thing:'Gizmo'},two:{thing:'Gizmo'}}; const overrides={thing:{gizmo:true}}; const r=scoreRound({players,answers,letter:'G',duplicatesAllowed:false,overrides}); assert.deepEqual(r.map((x)=>x.answers.thing.points),[5,5]); });
test('recordGame captures ranking, winner and round log, trimming to fifty', () => {
  const players=[{id:'a',name:'Alice',color:'#111'},{id:'b',name:'Bob',color:'#222'}];
  const game={settings:{theme:'classic',rounds:1,timer:60,playerCount:2,duplicatesAllowed:false},players:[{...players[0],score:40,lastScore:40},{...players[1],score:20,lastScore:20}],roundLog:[{round:1,letter:'A',results:[{total:40,answers:{thing:{value:'Apple',points:10}}},{total:20,answers:{thing:{value:'Ant',points:10}}}]}]};
  const history=recordGame([],game);
  assert.equal(history.length,1);
  assert.equal(history[0].winnerId,'a');
  assert.equal(history[0].players[0].name,'Alice');
  assert.equal(history[0].perRound[0].letter,'A');
  const big=Array.from({length:60},(_,i)=>recordSmall(i));
  assert.equal(recordGame(big,game).length,50);
});
function recordSmall(i){ return { id:`old-${i}`, date:new Date().toISOString(), theme:'classic', settings:{rounds:1,timer:60,playerCount:2,duplicatesAllowed:false}, players:[{id:'a',name:'Alice',color:'#111',score:10},{id:'b',name:'Bob',color:'#222',score:5}], winnerId:'a', perRound:[] }; }
test('computeStats aggregates wins, streaks, totals and category accuracy', () => {
  const g1 = {
    id: '1',
    date: new Date().toISOString(),
    theme: 'classic',
    settings: { rounds: 1, timer: 60, playerCount: 2, duplicatesAllowed: false },
    players: [
      { id: 'a', name: 'Alice', color: '#111', score: 30 },
      { id: 'b', name: 'Bob', color: '#222', score: 10 },
    ],
    winnerId: 'a',
    perRound: [
      {
        round: 1,
        letter: 'A',
        players: [
          { playerId: 'a', total: 30, answers: { thing: { value: 'Apple', points: 10, valid: true, duplicate: false }, place: { value: 'Alaska', points: 10, valid: true, duplicate: false }, animal: { value: 'Ant', points: 10, valid: true, duplicate: false } } },
          { playerId: 'b', total: 10, answers: { animal: { value: 'Bat', points: 10, valid: true, duplicate: false } } },
        ],
      },
    ],
  };
  const g2 = {
    id: '2',
    date: new Date().toISOString(),
    theme: 'classic',
    settings: { rounds: 1, timer: 60, playerCount: 2, duplicatesAllowed: false },
    players: [
      { id: 'a', name: 'Alice', color: '#111', score: 20 },
      { id: 'b', name: 'Bob', color: '#222', score: 50 },
    ],
    winnerId: 'b',
    perRound: [
      {
        round: 1,
        letter: 'B',
        players: [
          { playerId: 'a', total: 20, answers: { thing: { value: 'Box', points: 10, valid: true, duplicate: false }, name: { value: 'B1', points: 0, valid: false, duplicate: false } } },
          { playerId: 'b', total: 50, answers: { thing: { value: 'Ball', points: 10, valid: true, duplicate: false } } },
        ],
      },
    ],
  };
  const stats = computeStats([g1, g2]);
  const alice = stats.players.find((p) => p.id === 'a');
  assert.equal(stats.games, 2);
  assert.equal(alice.games, 2);
  assert.equal(alice.wins, 1);
  assert.equal(alice.points, 50);
  assert.equal(alice.winRate, 50);
  assert.equal(alice.bestRound, 30);
  assert.equal(alice.categories.thing.answered, 2);
  assert.equal(alice.categories.thing.scored, 2);
  assert.equal(alice.categories.name.answered, 1);
  assert.equal(alice.categories.name.scored, 0);
  const bob = stats.players.find((p) => p.id === 'b');
  assert.equal(bob.wins, 1);
  assert.equal(bob.streak, 1);
  assert.equal(bob.bestStreak, 1);
  assert.equal(alice.streak, 0);
});

test('applies speed bonus tiers from lock timing', () => {
  const r = scoreRound({ players: [{ id: 'a' }, { id: 'b' }], answers: { a: { place: 'Amsterdam' }, b: { place: 'Athens' } }, letter: 'A', duplicatesAllowed: false, timings: { a: 5, b: 20 }, timer: 60 });
  assert.equal(r[0].answers.place.speed, 3);
  assert.equal(r[1].answers.place.speed, 2);
  const late = scoreRound({ players: [{ id: 'a' }], answers: { a: { place: 'Atlanta' } }, letter: 'A', duplicatesAllowed: false, timings: { a: 55 }, timer: 60 });
  assert.equal(late[0].answers.place.speed, 0);
  const free = scoreRound({ players: [{ id: 'a' }], answers: { a: { place: 'Athens' } }, letter: 'A', duplicatesAllowed: false, timings: { a: 1 }, timer: 0 });
  assert.equal(free[0].answers.place.speed, 0);
});

test('unique bonus is shared-free and gated to multi-player tables', () => {
  const r = scoreRound({ players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], answers: { a: { place: 'Zanzibar City' }, b: { place: 'Zero Land' }, c: { place: 'Zanzibar City' } }, letter: 'Z', duplicatesAllowed: false });
  assert.equal(r[0].answers.place.unique, 0);
  assert.equal(r[1].answers.place.unique, 2);
  assert.equal(r[0].answers.place.points, 7);
  assert.equal(r[1].answers.place.points, 14);
  assert.equal(r[2].answers.place.points, 7);
  const solo = scoreRound({ players: [{ id: 'a' }], answers: { a: { place: 'Zero Land' } }, letter: 'Z', duplicatesAllowed: false });
  assert.equal(solo[0].answers.place.points, 12);
});

test('streak bonus rewards consecutive round wins without double counting', () => {
  const r = scoreRound({ players: [{ id: 'a' }, { id: 'b' }], answers: { a: { thing: 'Guitar' }, b: { thing: 'Zebra' } }, letter: 'G', duplicatesAllowed: false, streaks: { a: 2 } });
  assert.equal(r[0].roundWinner, true);
  assert.equal(r[0].streak, 3);
  assert.equal(r[0].answers.thing.streak, 2);
  assert.equal(r[0].total, 14);
  assert.equal(r[1].total, 0);
  const below = scoreRound({ players: [{ id: 'a' }, { id: 'b' }], answers: { a: { thing: 'Guitar' }, b: { thing: 'Zebra' } }, letter: 'G', duplicatesAllowed: false, streaks: { a: 1 } });
  assert.equal(below[0].answers.thing.streak, 0);
  const tied = scoreRound({ players: [{ id: 'a' }, { id: 'b' }], answers: { a: { thing: 'Guitar' }, b: { thing: 'Golem' } }, letter: 'G', duplicatesAllowed: false, streaks: { a: 4 } });
  assert.equal(tied[0].roundWinner, false);
  assert.equal(tied[0].answers.thing.streak, 0);
});

test('intense profile magnifies bonuses', () => {
  const r = scoreRound({ players: [{ id: 'a' }, { id: 'b' }], answers: { a: { thing: 'Guitar' }, b: { thing: 'Gun' } }, letter: 'G', duplicatesAllowed: false, profile: 'intense', timings: { a: 10 }, timer: 60, streaks: { a: 1 } });
  assert.equal(r[0].answers.thing.speed, 5);
  assert.equal(r[0].answers.thing.unique, 3);
  assert.equal(r[0].answers.thing.streak, 3);
  assert.equal(r[0].total, 21);
  assert.equal(r[1].total, 13);
});

test('scoring is pure and idempotent for the same inputs', () => {
  const inputs = { players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], answers: { a: { place: 'Zanzibar City', thing: 'Zipper' }, b: { place: 'Zero Land' }, c: { place: 'Zanzibar City', thing: 'Zine' } }, letter: 'Z', duplicatesAllowed: false, timings: { a: 9, b: 40 }, timer: 60, streaks: { c: 4 } };
  const first = scoreRound(inputs);
  const second = scoreRound(inputs);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((r) => r.total), second.map((r) => r.total));
});

test('settings clamp to sane bounds and preserve legacy shapes', () => {
  assert.equal(clampInt('abc', 2, 20, 2), 2);
  assert.equal(clampInt(7, 2, 20, 2), 7);
  assert.equal(clampInt(99, 2, 20, 2), 20);
  const s = sanitizeSettings({ playerCount: 99, rounds: 0, timer: 45, mode: 'bogus', duplicatesAllowed: true, categories: ['animal', 'animal', 'nope'], players: [] });
  assert.equal(s.playerCount, 20);
  assert.equal(s.rounds, 1);
  assert.equal(s.timer, 60);
  assert.equal(s.mode, 'classic');
  assert.equal(s.profile, 'standard');
  assert.deepEqual(s.categories, ['animal']);
  assert.equal(s.players.length, 20);
  assert.ok(s.players.every((p) => p.id && p.name && /^#/.test(p.color)));
  const speed = sanitizeSettings({ mode: 'speed', timer: 999 });
  assert.equal(speed.timer, 30);
  assert.equal(speed.profile, 'intense');
  const legacy = sanitizeSettings({ playerCount: 4, players: Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `Name ${i}`, color: '#334455' })) });
  assert.equal(legacy.playerCount, 4);
  assert.equal(legacy.players[3].id, 'p3');
  assert.deepEqual(legacy.categories, getCategories('classic').map((c) => c.key));
});

test('round winner detection is deterministic on ties', () => {
  assert.equal(roundWinnerId([{ playerId: 'a', total: 12 }, { playerId: 'b', total: 12 }]), null);
  assert.equal(roundWinnerId([{ playerId: 'a', total: 12 }, { playerId: 'b', total: 10 }]), 'a');
  assert.equal(roundWinnerId([{ playerId: 'a', total: 12 }]), 'a');
});

test('game modes expose sane defaults', () => {
  assert.equal(MODES.find((m) => m.key === 'classic').timer, 60);
  assert.equal(MODES.find((m) => m.key === 'speed').timer, 30);
  assert.equal(MODES.find((m) => m.key === 'speed').profile, 'intense');
  assert.equal(MODES.find((m) => m.key === 'sudden-death').profile, 'standard');
  assert.equal(LIMITS.minPlayers, 2);
  assert.equal(LIMITS.maxPlayers, 20);
  assert.equal(LIMITS.maxRounds, 15);
});

test('recordGame persists mode, profile, categories and player-keyed rounds', () => {
  const game = {
    settings: { theme: 'classic', mode: 'speed', profile: 'intense', rounds: 1, timer: 60, playerCount: 2, duplicatesAllowed: false, categories: ['animal'] },
    players: [{ id: 'a', name: 'Alpha', color: '#111', score: 12, streak: 1 }, { id: 'b', name: 'Beta', color: '#222', score: 0, streak: 0 }],
    survivorId: 'a',
    roundLog: [{ round: 1, letter: 'A', winnerId: 'a', timings: { a: 5 }, dead: [], results: [{ playerId: 'a', total: 12, answers: { animal: { value: 'Ant', points: 12 } } }, { playerId: 'b', total: 0, answers: { animal: { value: '', points: 0 } } }] }],
  };
  const h = recordGame([], game);
  assert.equal(h[0].mode, 'speed');
  assert.equal(h[0].settings.profile, 'intense');
  assert.deepEqual(h[0].settings.categories, ['animal']);
  assert.equal(h[0].winnerId, 'a');
  assert.equal(h[0].perRound[0].players[0].playerId, 'a');
  assert.equal(h[0].perRound[0].players[0].timeUsed, 5);
});

test('computeStats tracks participation, letters, uniqueness, speed and challenges', () => {
  const g = {
    id: 'x', date: new Date().toISOString(), theme: 'classic', mode: 'speed',
    settings: { rounds: 1, timer: 60, playerCount: 2, duplicatesAllowed: false, mode: 'speed', profile: 'intense', categories: ['animal', 'place'] },
    players: [{ id: 'a', name: 'A', color: '#111', score: 24 }, { id: 'b', name: 'B', color: '#222', score: 0 }],
    winnerId: 'a',
    perRound: [{ round: 1, letter: 'A', winnerId: 'a', players: [{ playerId: 'a', total: 24, timeUsed: 5, answers: { animal: { value: 'Ant', points: 12, valid: true, duplicate: false, unique: 2 }, place: { value: 'Alaska', points: 12, valid: true, duplicate: false, challenged: true } } }] }],
  };
  const stats = computeStats([g]);
  const a = stats.players.find((p) => p.id === 'a');
  const b = stats.players.find((p) => p.id === 'b');
  assert.equal(a.fastest, 5);
  assert.equal(a.uniqueCount, 1);
  assert.deepEqual(a.challenges, { tried: 1, won: 1 });
  assert.equal(a.bestScore, 24);
  assert.equal(a.totalRounds, 1);
  assert.equal(b.games, 1);
  assert.equal(b.totalRounds, 0);
  assert.equal(a.letters.A.answered, 2);
  assert.equal(a.letters.A.scored, 2);
  assert.equal(stats.recent[0].mode, 'speed');
});