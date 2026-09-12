import { HARD_LETTERS, standingsAfter } from './game.js';

export const MAX_GAMES = 50;

export function recordGame(history, game, { durationSec } = {}) {
  const base = Array.isArray(history) ? history : [];
  const players = Array.isArray(game && game.players) ? game.players : [];
  const roundLog = Array.isArray(game && game.roundLog) ? game.roundLog : [];
  const settings = game && game.settings && typeof game.settings === 'object' ? game.settings : {};
  const ranking = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const computedWinnerId = ranking.length > 1 && (ranking[0]?.score || 0) === (ranking[1]?.score || 0) ? null : ranking[0]?.id ?? null;
  const winnerId = game && game.survivorId ? game.survivorId : computedWinnerId;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    theme: settings.theme || 'classic',
    mode: settings.mode || (game && game.mode) || 'classic',
    settings: {
      rounds: settings.rounds,
      timer: settings.timer,
      playerCount: settings.playerCount,
      duplicatesAllowed: settings.duplicatesAllowed,
      mode: settings.mode || 'classic',
      profile: settings.profile || 'standard',
      categories: Array.isArray(settings.categories) ? settings.categories : [],
    },
    players: ranking.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score || 0, streak: p.streak || 0 })),
    winnerId,
    perRound: roundLog.map((round) => {
      const results = Array.isArray(round.results) ? round.results : [];
      return {
        round: round.round,
        letter: round.letter,
        winnerId: round.winnerId,
        dead: Array.isArray(round.dead) ? round.dead : [],
        players: results
          .filter((r) => r && r.playerId)
          .map((result) => ({
            playerId: result.playerId,
            total: result.total,
            timeUsed: round.timings?.[result.playerId] ?? undefined,
            answers: result.answers,
          })),
      };
    }),
    eliminatedOrder: roundLog.flatMap((round) => (Array.isArray(round.dead) ? round.dead : [])),
    durationSec: Number.isFinite(durationSec) ? durationSec : Number.isFinite(game && game.durationSec) ? game.durationSec : null,
  };
  return [entry, ...base].slice(0, MAX_GAMES);
}

export function computeStats(history = []) {
  const byPlayer = new Map();
  const getStat = (player) => {
    let stat = byPlayer.get(player.id);
    if (!stat) {
      stat = {
        id: player.id,
        name: player.name,
        color: player.color,
        games: 0,
        wins: 0,
        points: 0,
        bestScore: 0,
        bestRound: 0,
        categories: {},
        letters: {},
        streak: 0,
        bestStreak: 0,
        perfectRounds: 0,
        totalRounds: 0,
        fastest: null,
        uniqueCount: 0,
        challenges: { tried: 0, won: 0 },
        hardLetterWins: 0,
        comebacks: 0,
      };
      byPlayer.set(player.id, stat);
    }
    return stat;
  };

  history.forEach((game) => {
    if (!game || !Array.isArray(game.players)) return;
    game.players.forEach((player) => {
      if (!player || !player.id) return;
      const stat = getStat(player);
      stat.games += 1;
      stat.points += player.score || 0;
      if ((player.score || 0) > stat.bestScore) stat.bestScore = player.score;
      if (game.winnerId === player.id) stat.wins += 1;

      (Array.isArray(game.perRound) ? game.perRound : []).forEach((round) => {
        const mine = (Array.isArray(round.players) ? round.players : []).find((r) => r && r.playerId === player.id);
        if (!mine) return;
        stat.totalRounds += 1;
        if ((mine.total || 0) > stat.bestRound) stat.bestRound = mine.total;
        if (typeof mine.timeUsed === 'number' && Number.isFinite(mine.timeUsed) && (stat.fastest === null || mine.timeUsed < stat.fastest)) stat.fastest = mine.timeUsed;
        const answers = Object.values(mine.answers || {});
        if (answers.length > 0 && answers.every((a) => a && a.points > 0)) stat.perfectRounds += 1;
        Object.entries(mine.answers || {}).forEach(([key, answer]) => {
          if (!answer || !answer.value || !String(answer.value).trim()) return;
          const cat = stat.categories[key] || (stat.categories[key] = { answered: 0, scored: 0 });
          cat.answered += 1;
          if (answer.points > 0) cat.scored += 1;
          if (answer.unique > 0) stat.uniqueCount += 1;
          if (answer.challenged) {
            stat.challenges.tried += 1;
            if (answer.points > 0) stat.challenges.won += 1;
          }
          const letter = round.letter ? String(round.letter).toUpperCase() : '?';
          const lt = stat.letters[letter] || (stat.letters[letter] = { answered: 0, scored: 0 });
          lt.answered += 1;
          if (answer.points > 0) lt.scored += 1;
        });
        if (round.winnerId === player.id && HARD_LETTERS.includes(String(round.letter || '').toUpperCase())) stat.hardLetterWins += 1;
      });

      if (game.winnerId === player.id) {
        const rounds = Array.isArray(game.perRound) ? game.perRound : [];
        for (let r = 1; r < rounds.length; r++) {
          const standings = standingsAfter(rounds, r);
          const mine = standings.find((s) => s.playerId === player.id);
          const leader = standings[0];
          if (mine && leader && mine.score < leader.score) { stat.comebacks += 1; break; }
        }
      }
    });
  });

  history.slice(0, 10).forEach((game) => {
    if (!game || !Array.isArray(game.players)) return;
    game.players.forEach((player) => {
      const stat = byPlayer.get(player.id);
      if (!stat) return;
      if (game.winnerId === player.id) {
        stat.streak += 1;
        if (stat.streak > stat.bestStreak) stat.bestStreak = stat.streak;
      } else if (game.winnerId !== null && game.winnerId !== undefined) {
        stat.streak = 0;
      }
    });
  });

  return {
    games: history.length,
    players: [...byPlayer.values()]
      .map((p) => ({
        ...p,
        winRate: p.games ? Math.round((p.wins / p.games) * 100) : 0,
        avgScore: p.games ? Math.round(p.points / p.games) : 0,
        bestLetter: bestLetterOf(p.letters),
        form: history.slice(0, 8).map((game) => {
          const mine = game.players.find((g) => g.id === p.id);
          if (!mine) return null;
          return { win: game.winnerId === p.id, tie: game.winnerId === null, score: mine.score, date: game.date, id: game.id };
        }).filter(Boolean),
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name)),
    recent: history.slice(0, 8),
  };
}

function mergeCounts(target, source) {
  Object.entries(source || {}).forEach(([k, v]) => {
    if (!v) return;
    const bucket = target[k] || (target[k] = { answered: 0, scored: 0 });
    bucket.answered += v.answered || 0;
    bucket.scored += v.scored || 0;
  });
}

export function mergePlayerStats(players = []) {
  const byKey = new Map();
  players.forEach((p) => {
    if (!p || !p.name) return;
    const key = String(p.name).trim().toLocaleLowerCase();
    let m = byKey.get(key);
    if (!m) {
      m = {
        key,
        id: key,
        name: p.name,
        color: p.color,
        games: 0,
        wins: 0,
        points: 0,
        bestScore: 0,
        bestRound: 0,
        categories: {},
        letters: {},
        streak: 0,
        bestStreak: 0,
        perfectRounds: 0,
        totalRounds: 0,
        fastest: null,
        uniqueCount: 0,
        challenges: { tried: 0, won: 0 },
        hardLetterWins: 0,
        comebacks: 0,
        form: [],
      };
      byKey.set(key, m);
    }
    m.games += p.games || 0;
    m.wins += p.wins || 0;
    m.points += p.points || 0;
    if ((p.bestScore || 0) > m.bestScore) m.bestScore = p.bestScore;
    if ((p.bestRound || 0) > m.bestRound) m.bestRound = p.bestRound;
    m.bestStreak = Math.max(m.bestStreak, p.bestStreak || 0);
    if (p.streak) m.streak = Math.max(m.streak, p.streak);
    m.perfectRounds += p.perfectRounds || 0;
    m.totalRounds += p.totalRounds || 0;
    if (typeof p.fastest === 'number' && p.fastest >= 0 && (m.fastest === null || p.fastest < m.fastest)) m.fastest = p.fastest;
    m.uniqueCount += p.uniqueCount || 0;
    m.challenges.tried += p.challenges?.tried || 0;
    m.challenges.won += p.challenges?.won || 0;
    m.hardLetterWins += p.hardLetterWins || 0;
    m.comebacks += p.comebacks || 0;
    mergeCounts(m.categories, p.categories);
    mergeCounts(m.letters, p.letters);
    m.form = [...m.form, ...(p.form || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
  });
  return [...byKey.values()]
    .map((p) => ({
      ...p,
      winRate: p.games ? Math.round((p.wins / p.games) * 100) : 0,
      avgScore: p.games ? Math.round(p.points / p.games) : 0,
      avgRound: p.totalRounds ? Math.round(p.points / p.totalRounds) : 0,
      perfectRate: p.totalRounds ? Math.round((p.perfectRounds / p.totalRounds) * 100) : 0,
      bestLetter: bestLetterOf(p.letters),
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

export function computeCareerStats(history = []) {
  return mergePlayerStats(computeStats(history).players);
}

function bestLetterOf(letters) {
  let best = null;
  let bestRate = 0;
  let bestAnswered = 2;
  Object.entries(letters || {}).forEach(([letter, value]) => {
    if (value.answered < 2) return;
    const rate = value.scored / value.answered;
    if (rate > bestRate || (rate === bestRate && value.answered > bestAnswered)) {
      best = letter;
      bestRate = rate;
      bestAnswered = value.answered;
    }
  });
  return best;
}