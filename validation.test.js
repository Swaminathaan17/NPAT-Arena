import test from 'node:test';
import assert from 'node:assert/strict';
import { getCategories, scoreRound } from './game.js';
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
test('scoring respects the selected theme', () => { const players=[{id:'one'}]; const classicAnswers={one:{name:'Mia',place:'Madrid',animal:'Moose',thing:'Mic'}}; const classic=scoreRound({players,answers:classicAnswers,letter:'M',duplicatesAllowed:true,categories:getCategories('classic')}); assert.equal(classic[0].total,40); const foodieAnswers={one:{food:'Mango',drink:'Milk',place:'Madrid',thing:'Mic'}}; const foodie=scoreRound({players,answers:foodieAnswers,letter:'M',duplicatesAllowed:true,categories:getCategories('foodie')}); assert.equal(foodie[0].total,40); const classicOnFoodie=scoreRound({players,answers:foodieAnswers,letter:'M',duplicatesAllowed:true,categories:getCategories('classic')}); assert.equal(classicOnFoodie[0].total,20); });
test('adjudication overrides force unrecognized answers valid and integrate duplicates', () => { const players=[{id:'one'},{id:'two'}]; const answers={one:{place:'Gizmo'},two:{place:'Gizmer'}}; const overrides={place:{gizmo:true}}; const r=scoreRound({players,answers,letter:'G',duplicatesAllowed:false,overrides}); assert.equal(r[0].answers.place.valid,true); assert.equal(r[0].answers.place.challenged,true); assert.equal(r[0].answers.place.points,10); assert.equal(r[1].answers.place.valid,false); });
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