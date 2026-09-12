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

export const getCategories = (theme, custom = null) => {
  const keys = Array.isArray(custom) && custom.length ? custom : (THEMES.find((t) => t.key === theme) || THEMES[0]).categories;
  return keys.map((key) => CATEGORY_DEFS[key]).filter(Boolean);
};
export const CATEGORIES = getCategories('classic');

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const randomLetter = (used = []) => {
  const pool = LETTERS.filter((letter) => !used.includes(letter));
  return (pool.length ? pool : LETTERS)[Math.floor(Math.random() * (pool.length ? pool.length : LETTERS.length))];
};
export const normalize = (value) => canonicalize(value);

export const PLAYER_COLORS = ['#A78BFA', '#34D399', '#F59E0B', '#60A5FA', '#F472B6', '#FB7185', '#22D3EE', '#C084FC'];

/* Limits & options ------------------------------------------------------ */

export const LIMITS = { minPlayers: 2, maxPlayers: 20, minRounds: 1, maxRounds: 15, minCategories: 1 };
export const TIMER_OPTIONS = [0, 30, 60, 90];
export const ROUND_OPTIONS = [1, 3, 5, 10];
export const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/* Game modes ------------------------------------------------------------- */

export const MODES = [
  { key: 'classic', name: 'Classic', profile: 'standard', timer: 60, tag: 'Balanced scoring, classic pace', icon: '◆' },
  { key: 'speed', name: 'Speed Round', profile: 'intense', timer: 30, tag: 'Short clock, bigger bonuses, fast reveal', icon: '⚡' },
  { key: 'sudden-death', name: 'Sudden Death', profile: 'standard', timer: 60, tag: 'Score zero and you are out — last one standing', icon: '☠' },
];

/* Scoring profiles ------------------------------------------------------- */

export const SCORING_PROFILES = {
  standard: { key: 'standard', name: 'Balanced', base: 10, duplicate: 5, speed: [3, 2, 1, 0], unique: 2, streak: [{ at: 3, bonus: 2 }, { at: 5, bonus: 5 }], hardLetter: 2, rareCategory: 1 },
  intense: { key: 'intense', name: 'High momentum', base: 10, duplicate: 5, speed: [5, 3, 2, 0], unique: 3, streak: [{ at: 2, bonus: 3 }, { at: 4, bonus: 8 }], hardLetter: 3, rareCategory: 2 },
};
export const HARD_LETTERS = ['J', 'K', 'Q', 'V', 'X', 'Z'];
export const RARE_CATEGORIES = ['profession', 'drink'];

/* Scoring helpers -------------------------------------------------------- */

export const speedTier = (timeUsed, timer) => {
  if (!timer || typeof timeUsed !== 'number' || !Number.isFinite(timeUsed) || timeUsed < 0) return 3;
  const ratio = timeUsed / timer;
  if (ratio <= 0.25) return 0;
  if (ratio <= 0.5) return 1;
  if (ratio <= 0.75) return 2;
  return 3;
};

export const streakBonusFor = (count, profile = 'standard') => {
  const cfg = SCORING_PROFILES[profile] || SCORING_PROFILES.standard;
  let bonus = 0;
  (cfg.streak || []).forEach(({ at, bonus: b }) => { if (count >= at && b > bonus) bonus = b; });
  return bonus;
};

export const roundWinnerId = (results) => {
  const sorted = [...results].sort((a, b) => b.total - a.total);
  if (!sorted.length) return null;
  return sorted.length > 1 && sorted[0].total === sorted[1].total ? null : sorted[0].playerId;
};

/* Settings sanitation ---------------------------------------------------- */

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const sanitizeSettings = (raw = {}) => {
  const mode = MODES.find((m) => m.key === raw.mode) || MODES[0];
  const profile = SCORING_PROFILES[raw.profile] ? raw.profile : mode.profile;
  const timer = TIMER_OPTIONS.includes(Number(raw.timer)) ? Number(raw.timer) : mode.timer;
  const rounds = clampInt(raw.rounds, LIMITS.minRounds, LIMITS.maxRounds, 5);
  const playerCount = clampInt(raw.playerCount, LIMITS.minPlayers, LIMITS.maxPlayers, 2);
  const theme = THEMES.find((t) => t.key === raw.theme) || THEMES[0];
  const validCategories = Object.keys(CATEGORY_DEFS);
  const chosen = Array.isArray(raw.categories)
    ? raw.categories.filter((key) => validCategories.includes(key))
    : [];
  const categories = chosen.length ? [...new Set(chosen)].slice(0, validCategories.length) : theme.categories;
  const rawPlayers = Array.isArray(raw.players) ? raw.players : [];
  const players = Array.from({ length: playerCount }, (_, i) => {
    const src = typeof rawPlayers[i] === 'object' && rawPlayers[i] ? rawPlayers[i] : {};
    const name = String(src.name || '').trim().slice(0, 24) || `Player ${i + 1}`;
    const color = typeof src.color === 'string' && /^#[\da-f]{6}$/i.test(src.color) ? src.color : PLAYER_COLORS[i % PLAYER_COLORS.length];
    return { id: typeof src.id === 'string' && src.id ? src.id : newId(), name, color };
  });
  return {
    playerCount,
    players,
    duplicatesAllowed: Boolean(raw.duplicatesAllowed),
    timer,
    rounds,
    theme: theme.key,
    mode: mode.key,
    profile,
    categories,
  };
};

/* Scoring ---------------------------------------------------------------- */

export const scoreRound = ({ players, answers, letter, duplicatesAllowed, overrides = {}, categories = CATEGORIES, profile = 'standard', streaks = {}, timings = {}, timer = 0 }) => {
  const cfg = SCORING_PROFILES[profile] || SCORING_PROFILES.standard;
  const expected = canonicalize(letter).charAt(0);
  const playable = players.length >= 2;
  const emptyBonus = { unique: 0, speed: 0, difficulty: 0, streak: 0 };
  const results = players.map((player) => ({ playerId: player.id, answers: {}, total: 0, roundWinner: false, streak: 0, bonuses: { ...emptyBonus } }));

  categories.forEach(({ key }) => {
    const validations = players.map((player) => {
      const raw = validateAnswer(answers[player.id]?.[key] || '', key, letter);
      const forced = Boolean(overrides[key]?.[raw.normalized]) && Boolean(raw.normalized) && raw.normalized.charAt(0) === expected;
      return forced ? { ...raw, valid: true, reason: '', challenged: true } : { ...raw, challenged: false };
    });
    const frequency = validations.reduce((acc, validation) => {
      const k = duplicateKey(validation.normalized);
      return validation.valid ? { ...acc, [k]: (acc[k] || 0) + 1 } : acc;
    }, {});
    players.forEach((player, index) => {
      const validation = validations[index];
      const result = results[index];
      const valid = validation.valid;
      const duplicate = valid && !duplicatesAllowed && frequency[duplicateKey(validation.normalized)] > 1;
      const unique = valid && !duplicate && playable && frequency[duplicateKey(validation.normalized)] === 1;
      const tier = speedTier(timings[player.id], timer);
      const difficulty = (HARD_LETTERS.includes(letter.toUpperCase()) ? cfg.hardLetter : 0) + (RARE_CATEGORIES.includes(key) ? cfg.rareCategory : 0);
      const speed = valid ? cfg.speed[tier] : 0;
      const answer = {
        value: answers[player.id]?.[key] || '',
        valid,
        duplicate,
        unique: unique ? cfg.unique : 0,
        speed,
        difficulty,
        streak: 0,
        base: 0,
        dup: 0,
        points: 0,
        reason: duplicate ? 'Duplicate answer · shared points.' : validation.reason,
        normalized: validation.normalized,
        challenged: validation.challenged,
      };
      if (valid) {
        if (duplicate) { answer.dup = cfg.duplicate; } else { answer.base = cfg.base; }
        answer.unique = unique ? cfg.unique : 0;
        answer.points = answer.base + answer.dup + answer.unique + answer.speed + answer.difficulty;
      }
      result.answers[key] = answer;
      result.total += answer.points;
      result.bonuses.unique += answer.unique;
      result.bonuses.speed += answer.speed;
      result.bonuses.difficulty += answer.difficulty;
    });
  });

  const winnerId = roundWinnerId(results);
  if (winnerId) {
    const winnerIndex = results.findIndex((r) => r.playerId === winnerId);
    const winner = results[winnerIndex];
    const nextStreak = (streaks[winnerId] || 0) + 1;
    const streakBonus = streakBonusFor(nextStreak, profile);
    winner.roundWinner = true;
    winner.streak = nextStreak;
    if (streakBonus) {
      Object.values(winner.answers).forEach((answer) => {
        if (answer.valid) {
          answer.streak = streakBonus;
          answer.points += streakBonus;
          winner.total += streakBonus;
          winner.bonuses.streak += streakBonus;
        }
      });
    }
  }
  return results;
};

/* Phase 4 — pure game-state helpers ------------------------------------ */

export const suddenDeathEnd = (alive = []) => ({
  finished: alive.length <= 1,
  survivorId: alive.length === 1 ? alive[0] : null,
});

export const standingsAfter = (roundLog = [], upTo) => {
  const rounds = Array.isArray(roundLog) ? roundLog : [];
  const limit = upTo == null ? rounds.length : Math.max(0, Math.min(Number(upTo), rounds.length));
  const scores = {};
  for (let i = 0; i < limit; i++) {
    const round = rounds[i] || {};
    const entries = Array.isArray(round.results) ? round.results : Array.isArray(round.players) ? round.players : [];
    entries.forEach((r) => {
      if (!r || !r.playerId) return;
      const total = Number(r.total);
      scores[r.playerId] = (scores[r.playerId] || 0) + (Number.isFinite(total) ? total : 0);
    });
  }
  return Object.entries(scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
};

export const scoreExplanation = (answer) => {
  const parts = [];
  const add = (label, value) => { if (value) parts.push({ label, value }); };
  add('Base', answer?.base);
  add('Duplicate', answer?.dup);
  add('Unique', answer?.unique);
  add('Speed', answer?.speed);
  add('Bonus', answer?.difficulty);
  add('Streak', answer?.streak);
  return { parts, total: parts.reduce((s, p) => s + p.value, 0) };
};

export const computeHighlights = (game = {}) => {
  const players = Array.isArray(game.players) ? game.players : [];
  const roundLog = Array.isArray(game.roundLog) ? game.roundLog : [];
  const nameOf = (id) => players.find((p) => p.id === id)?.name || 'Unknown';
  const out = [];

  let fastest = null;
  roundLog.forEach((round, index) => {
    const timings = round.timings || {};
    (round.results || []).forEach((r) => {
      if (!r || !r.playerId) return;
      const hasValid = Object.values(r.answers || {}).some((a) => a && a.points > 0);
      const t = timings[r.playerId];
      if (hasValid && typeof t === 'number' && Number.isFinite(t) && t >= 0 && (!fastest || t < fastest.value)) {
        fastest = { playerId: r.playerId, value: t, round: index + 1 };
      }
    });
  });
  if (fastest) out.push({ key: 'fastest', playerId: fastest.playerId, name: nameOf(fastest.playerId), value: fastest.value, round: fastest.round, icon: 'Zap', label: 'Fastest answer' });

  let biggest = null;
  roundLog.forEach((round, index) => {
    (round.results || []).forEach((r) => {
      if (!r || !r.playerId) return;
      const total = Number(r.total);
      if (Number.isFinite(total) && (!biggest || total > biggest.value)) biggest = { playerId: r.playerId, value: total, round: index + 1 };
    });
  });
  if (biggest && biggest.value > 0) out.push({ key: 'biggest', playerId: biggest.playerId, name: nameOf(biggest.playerId), value: biggest.value, round: biggest.round, icon: 'TrendingUp', label: 'Biggest round' });

  const winnerId = game.survivorId || roundLog[roundLog.length - 1]?.winnerId || null;
  if (winnerId) {
    for (let r = 1; r < roundLog.length; r++) {
      const s = standingsAfter(roundLog, r);
      const mine = s.find((x) => x.playerId === winnerId);
      if (mine && s[0] && mine.score < s[0].score) {
        out.push({ key: 'comeback', playerId: winnerId, name: nameOf(winnerId), value: r, round: r, icon: 'RotateCcw', label: 'Comeback win' });
        break;
      }
    }
  }

  let longestId = null;
  let longest = 0;
  players.forEach((p) => { if ((p.streak || 0) > longest) { longest = p.streak; longestId = p.id; } });
  if (longest >= 2 && longestId) out.push({ key: 'streak', playerId: longestId, name: nameOf(longestId), value: longest, round: null, icon: 'Flame', label: 'Longest streak' });

  const uniques = {};
  roundLog.forEach((round) => (round.results || []).forEach((r) => {
    if (!r || !r.playerId) return;
    const n = Object.values(r.answers || {}).reduce((sum, a) => sum + (a && a.unique ? 1 : 0), 0);
    if (n) uniques[r.playerId] = (uniques[r.playerId] || 0) + n;
  }));
  const topUnique = Object.entries(uniques).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (topUnique && topUnique[1] > 0) out.push({ key: 'unique', playerId: topUnique[0], name: nameOf(topUnique[0]), value: topUnique[1], round: null, icon: 'Sparkles', label: 'Most unique answers' });

  const challenges = {};
  roundLog.forEach((round) => (round.results || []).forEach((r) => {
    if (!r || !r.playerId) return;
    const n = Object.values(r.answers || {}).reduce((sum, a) => sum + (a && a.challenged && a.points > 0 ? 1 : 0), 0);
    if (n) challenges[r.playerId] = (challenges[r.playerId] || 0) + n;
  }));
  const topChallenge = Object.entries(challenges).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (topChallenge && topChallenge[1] > 0) out.push({ key: 'challenge', playerId: topChallenge[0], name: nameOf(topChallenge[0]), value: topChallenge[1], round: null, icon: 'Gavel', label: 'Challenges won' });

  const tough = roundLog.find((round) => round && HARD_LETTERS.includes(String(round.letter || '').toUpperCase()) && round.winnerId);
  if (tough) out.push({ key: 'toughLetter', playerId: tough.winnerId, name: nameOf(tough.winnerId), value: String(tough.letter).toUpperCase(), round: tough.round, icon: 'Shield', label: 'Tough letter round' });

  return out;
};