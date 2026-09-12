const MAX_GAMES = 50;

export function recordGame(history, game) {
  const ranking = [...game.players].sort((a, b) => b.score - a.score);
  const winnerId = ranking.length > 1 && ranking[0].score === ranking[1].score ? null : ranking[0]?.id ?? null;
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    theme: game.settings.theme || 'classic',
    settings: {
      rounds: game.settings.rounds,
      timer: game.settings.timer,
      playerCount: game.settings.playerCount,
      duplicatesAllowed: game.settings.duplicatesAllowed,
    },
    players: ranking.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score })),
    winnerId,
    perRound: (game.roundLog || []).map((round) => ({
      round: round.round,
      letter: round.letter,
      players: round.results.map((result, index) => ({
        playerId: game.players[index]?.id ?? `p${index}`,
        total: result.total,
        answers: result.answers,
      })),
    })),
  };
  return [entry, ...history].slice(0, MAX_GAMES);
}

export function computeStats(history) {
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
        bestRound: 0,
        categories: {},
        streak: 0,
        bestStreak: 0,
        perfectRounds: 0,
        totalRounds: 0,
      };
      byPlayer.set(player.id, stat);
    }
    return stat;
  };

  history.forEach((game) => {
    game.players.forEach((player) => {
      const stat = getStat(player);
      stat.games += 1;
      stat.points += player.score;
      if (game.winnerId === player.id) stat.wins += 1;

      game.perRound.forEach((round) => {
        const mine = round.players.find((r) => r.playerId === player.id);
        if (mine && mine.total > stat.bestRound) stat.bestRound = mine.total;
        stat.totalRounds += 1;
        if (mine) {
          const answers = Object.values(mine.answers || {});
          if (answers.length > 0 && answers.every((a) => a?.points > 0)) stat.perfectRounds += 1;
        }
        Object.entries(mine?.answers || {}).forEach(([key, answer]) => {
          const cat = stat.categories[key] || (stat.categories[key] = { answered: 0, scored: 0 });
          if (answer?.value && String(answer.value).trim()) {
            cat.answered += 1;
            if (answer.points > 0) cat.scored += 1;
          }
        });
      });
    });
  });

  history.forEach((game) => {
    game.players.forEach((player) => {
      const stat = byPlayer.get(player.id);
      if (!stat) return;
      if (game.winnerId === player.id) {
        stat.streak += 1;
        if (stat.streak > stat.bestStreak) stat.bestStreak = stat.streak;
      } else {
        stat.streak = 0;
      }
    });
  });

  return {
    games: history.length,
    players: [...byPlayer.values()]
      .map((p) => ({ ...p, winRate: p.games ? Math.round((p.wins / p.games) * 100) : 0 }))
      .sort((a, b) => b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name)),
    recent: history.slice(0, 8),
  };
}