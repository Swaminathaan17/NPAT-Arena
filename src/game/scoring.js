import { canonicalize, duplicateKey, validateAnswer } from './validation.js';
import { CATEGORIES, CATEGORY_KEYS } from './categories.js';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const POINTS = { unique: 10, duplicate: 5 };

export const randomLetter = (used = []) => {
  const pool = LETTERS.filter((letter) => !used.includes(letter));
  return (pool.length ? pool : LETTERS)[Math.floor(Math.random() * (pool.length ? pool.length : LETTERS.length))];
};

const emptyAnswer = (value, code, reason, normalized) => ({
  value: String(value || ''),
  valid: false,
  duplicate: false,
  unique: false,
  points: 0,
  code,
  reason,
  normalized,
});

export function scoreRound({ players, submissions, letter }) {
  const roster = Array.isArray(players) ? players : [];
  const subs = submissions && typeof submissions === 'object' ? submissions : {};
  const expected = canonicalize(letter).charAt(0);

  const validate = (playerId, category) => {
    const raw = typeof subs[playerId] === 'object' && subs[playerId] ? subs[playerId] : {};
    const value = typeof raw[category] === 'string' ? raw[category] : '';
    const normalized = canonicalize(value);
    if (!normalized.trim()) return emptyAnswer(value, 'blank', 'Blank answer · 0 pts', normalized);
    const checked = validateAnswer(value, category, letter);
    return { value, valid: checked.valid, duplicate: false, unique: false, points: 0, code: checked.code, reason: checked.reason, normalized: checked.normalized };
  };

  const results = roster.map((player) => ({
    playerId: player.id,
    name: player.name,
    total: 0,
    answers: Object.fromEntries(CATEGORY_KEYS.map((category) => [category, validate(player.id, category)])),
  }));
  const byPlayer = Object.fromEntries(results.map((result) => [result.playerId, result]));

  CATEGORY_KEYS.forEach((category) => {
    const groups = new Map();
    roster.forEach(({ id }) => {
      const answer = byPlayer[id].answers[category];
      if (!answer.valid) return;
      const groupKey = duplicateKey(answer.normalized);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(id);
    });
    roster.forEach(({ id }) => {
      const answer = byPlayer[id].answers[category];
      if (!answer.valid) return;
      const duplicate = (groups.get(duplicateKey(answer.normalized)) || []).length > 1;
      answer.duplicate = duplicate;
      answer.unique = !duplicate;
      answer.points = duplicate ? POINTS.duplicate : POINTS.unique;
      answer.reason = duplicate ? 'Duplicate answer · +5' : `Correct · +${POINTS.unique}`;
      byPlayer[id].total += answer.points;
    });
  });

  return results;
}

export const assertCategories = () => {
  if (JSON.stringify(CATEGORY_KEYS) !== JSON.stringify(['name', 'place', 'animal', 'thing'])) {
    throw new Error('Category set must be exactly Name, Place, Animal, Thing');
  }
  if (CATEGORIES.length !== 4) throw new Error('Exactly four categories are required');
};

assertCategories();

export const maxRoundScore = () => CATEGORIES.length * POINTS.unique;