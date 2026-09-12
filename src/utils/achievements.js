export const ACHIEVEMENTS = [
  { key: 'firstWin', name: 'First Blood', detail: 'Win your first match.', icon: 'Trophy' },
  { key: 'perfectRound', name: 'Perfect Round', detail: 'Score points in every category of a single round.', icon: 'Target' },
  { key: 'speedDemon', name: 'Speed Demon', detail: 'Land a valid answer in 8 seconds or less.', icon: 'Zap' },
  { key: 'uniqueMind', name: 'Unique Mind', detail: 'Submit 10 answers nobody else shared.', icon: 'Sparkles' },
  { key: 'streakMaster', name: 'Untouchable', detail: 'Win 3 matches in a row.', icon: 'Flame' },
  { key: 'challengeKing', name: 'Table Judge', detail: 'Win 2 challenges.', icon: 'Gavel' },
  { key: 'letterSurvivor', name: 'Tough Letters', detail: 'Win a round played on a hard letter (J·K·Q·V·X·Z).', icon: 'Shield' },
  { key: 'consistent', name: 'Consistent', detail: 'Win 60% of 3+ matches.', icon: 'Medal' },
  { key: 'comeback', name: 'Comeback King', detail: 'Win a match after trailing mid-game.', icon: 'TrendingUp' },
];

const ACH_KEYS = ACHIEVEMENTS.map((a) => a.key);
const criteria = {
  firstWin: (c) => (c.wins || 0) >= 1,
  perfectRound: (c) => (c.perfectRounds || 0) >= 1,
  speedDemon: (c) => typeof c.fastest === 'number' && c.fastest >= 0 && c.fastest <= 8,
  uniqueMind: (c) => (c.uniqueCount || 0) >= 10,
  streakMaster: (c) => (c.bestStreak || 0) >= 3,
  challengeKing: (c) => (c.challenges?.won || 0) >= 2,
  letterSurvivor: (c) => (c.hardLetterWins || 0) >= 1,
  consistent: (c) => (c.games || 0) >= 3 && (c.winRate || 0) >= 60,
  comeback: (c) => (c.comebacks || 0) >= 1,
};

export function evaluateCareer(career) {
  if (!career || typeof career !== 'object') return [];
  return ACH_KEYS.filter((key) => criteria[key] && criteria[key](career) === true);
}

export function mergeAchievements(careerPlayers = [], stored = {}, { now = new Date() } = {}) {
  const base = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const next = JSON.parse(JSON.stringify(base));
  const newlyUnlocked = [];
  careerPlayers.forEach((player) => {
    if (!player || !player.key) return;
    const nameKey = String(player.key).toLocaleLowerCase();
    const achieved = evaluateCareer(player);
    if (!achieved.length) return;
    const current = (next[nameKey] && typeof next[nameKey] === 'object' ? next[nameKey] : {});
    const updated = { ...current };
    achieved.forEach((key) => {
      if (!updated[key]) {
        updated[key] = now.toISOString();
        newlyUnlocked.push({ playerKey: nameKey, playerName: player.name, key, achievement: ACHIEVEMENTS.find((a) => a.key === key) });
      }
    });
    next[nameKey] = updated;
  });
  return { stored: next, newlyUnlocked };
}