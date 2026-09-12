import { canonicalize, duplicateKey, validateAnswer } from './validation.js';

export const CATEGORY_DEFS = {
  name: { key: 'name', label: 'Name', hint: 'A person', icon: '◉' },
  place: { key: 'place', label: 'Place', hint: 'A destination', icon: '⌖' },
  animal: { key: 'animal', label: 'Animal', hint: 'A creature', icon: '♧' },
  thing: { key: 'thing', label: 'Thing', hint: 'Anything at all', icon: '◇' },
  food: { key: 'food', label: 'Food', hint: 'Something edible', icon: '❖' },
  drink: { key: 'drink', label: 'Drink', hint: 'Something to sip', icon: '⊛' },
  profession: { key: 'profession', label: 'Job', hint: 'A profession', icon: '⚙' },
};

export const THEMES = [
  { key: 'classic', name: 'Classic', tag: 'Name · Place · Animal · Thing', categories: ['name', 'place', 'animal', 'thing'] },
  { key: 'foodie', name: 'Foodie', tag: 'Food · Drink · Place · Thing', categories: ['food', 'drink', 'place', 'thing'] },
  { key: 'career', name: 'Career Day', tag: 'Job · Place · Animal · Thing', categories: ['profession', 'place', 'animal', 'thing'] },
];

export const getCategories = (theme) => (THEMES.find((t) => t.key === theme) || THEMES[0]).categories.map((key) => CATEGORY_DEFS[key]);
export const CATEGORIES = getCategories('classic');

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const randomLetter = (used = []) => {
  const pool = LETTERS.filter((letter) => !used.includes(letter));
  return (pool.length ? pool : LETTERS)[Math.floor(Math.random() * (pool.length ? pool.length : LETTERS.length))];
};
export const normalize = (value) => canonicalize(value);
export const scoreRound = ({ players, answers, letter, duplicatesAllowed, overrides = {}, categories = CATEGORIES }) => {
  const expected = canonicalize(letter).charAt(0);
  const results = players.map((player) => ({ playerId: player.id, answers: {}, total: 0 }));
  categories.forEach(({ key }) => {
    const validations = players.map((player) => {
      const raw = validateAnswer(answers[player.id]?.[key] || '', key, letter);
      const forced = Boolean(overrides[key]?.[raw.normalized]) && Boolean(raw.normalized) && raw.normalized.charAt(0) === expected;
      return forced ? { ...raw, valid: true, reason: '', challenged: true } : { ...raw, challenged: false };
    });
    const frequency = validations.reduce((acc, validation) => { const key = duplicateKey(validation.normalized); return validation.valid ? { ...acc, [key]: (acc[key] || 0) + 1 } : acc; }, {});
    players.forEach((player, index) => {
      const validation = validations[index];
      const valid = validation.valid;
      const duplicate = valid && !duplicatesAllowed && frequency[duplicateKey(validation.normalized)] > 1;
      const points = valid ? (duplicate ? 5 : 10) : 0;
      results[index].answers[key] = { value: answers[player.id]?.[key] || '', valid, duplicate, points, reason: duplicate ? 'Duplicate answer · shared points.' : validation.reason, normalized: validation.normalized, challenged: validation.challenged };
      results[index].total += points;
    });
  });
  return results;
};