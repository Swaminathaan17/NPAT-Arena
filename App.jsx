import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Crown, Gavel, Medal, RotateCcw, Sparkles, Trash2, Trophy, Users, Volume2, VolumeX, X } from 'lucide-react';
import { CATEGORY_DEFS, LETTERS, THEMES, getCategories, randomLetter, scoreRound } from './game';
import { useTimer } from './useTimer';
import { KEYS, load, loadSettings, save } from './storage';
import { computeStats, recordGame } from './stats';
import { setMuted as setSoundMuted, sounds } from './sounds';

const colors = ['#A78BFA','#34D399','#F59E0B','#60A5FA','#F472B6','#FB7185','#22D3EE','#C084FC'];
const medalTone = ['#ffe08a', '#c8cede', '#e3a06a'];
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const freshPlayers = (count) => Array.from({ length: count }, (_, i) => ({ id: uid(), name: `Player ${i + 1}`, color: colors[i % colors.length] }));
const initialSettings = { playerCount: 2, players: freshPlayers(2), duplicatesAllowed: false, timer: 60, rounds: 5, theme: 'classic' };
const readSaved = () => ({ ...initialSettings, ...loadSettings(initialSettings) });

function Button({ children, variant = 'primary', className = '', ...props }) { return <button className={`button ${variant} ${className}`} {...props}>{children}</button>; }
function Avatar({ player, small = false }) { return <span className={`avatar ${small ? 'small' : ''}`} style={{ background: player.color }}>{player.name.trim().slice(0, 1).toUpperCase() || '?'}</span>; }
function Shell({ children }) { return <main className="shell"><div className="ambient a"/><div className="ambient b"/>{children}</main>; }

const RADIUS = 29;
const CIRC = 2 * Math.PI * RADIUS;
function TimerRing({ time, total }) {
  const pct = total ? Math.min(time / total, 1) : 1;
  const urgency = time <= 5 ? 'critical' : time <= 15 ? 'warning' : '';
  const color = time <= 5 ? 'var(--danger)' : time <= 15 ? 'var(--warning)' : 'var(--accent)';
  return <div className={`timer-ring ${urgency}`}>
    <svg viewBox="0 0 72 72">
      <circle className="timer-ring-track" cx="36" cy="36" r={RADIUS}/>
      <circle className="timer-ring-progress" cx="36" cy="36" r={RADIUS} style={{ stroke: color, strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - pct) }}/>
    </svg>
    <span className="timer-ring-time">{time}</span>
  </div>;
}

function Landing({ begin, onStats, history }) {
  const reduce = useReducedMotion();
  const fade = (delay = 0) => reduce ? false : { opacity: 0, y: 16 };
  const last = history[0];
  const winner = last?.winnerId ? last.players.find((p) => p.id === last.winnerId) : null;
  return <Shell><section className="landing">
    <motion.div initial={fade()} animate={{ opacity: 1, y: 0 }} className="eyebrow"><Sparkles size={15}/> A classic game, reimagined</motion.div>
    <motion.h1 initial={fade()} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="landing-title">NP<span>AT</span></motion.h1>
    <motion.p initial={fade()} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="tagline">NAME. PLACE. ANIMAL. THING.</motion.p>
    <p className="intro">Think fast. Fill every category. Own the round. A familiar favorite with a new competitive edge.</p>
    <div className="landing-actions">
      {last && winner && <motion.div initial={fade()} animate={{ opacity: 1, y: 0 }} className="landing-flash glass"><Trophy size={20}/><div><b>Last game — {winner.name}</b><small>{new Date(last.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {last.settings.playerCount} players · {winner.score} pts</small></div></motion.div>}
      <Button onClick={begin} className="hero-cta">START GAME <ArrowRight size={18}/></Button>
      <Button variant="quiet" onClick={onStats} className="hero-cta-secondary"><BarChart3 size={16}/> SCOREBOARD</Button>
    </div>
    <div className="landing-badges">
      <span className="landing-pill"><Clock3 size={13}/> Timed rounds</span>
      <span className="landing-pill"><Users size={13}/> 2–20 players</span>
      <span className="landing-pill"><Sparkles size={13}/> On-device history</span>
      <span className="landing-pill"><Gavel size={13}/> Table challenges</span>
    </div>
    <div className="feature-grid">{[['⚡','Fast rounds'],['◎','Random letters'],['✦','Smart scoring'],['◌','Built to play together']].map(([icon, text]) => <div className="feature" key={text}><span>{icon}</span>{text}</div>)}</div>
  </section></Shell>;
}

function Setup({ settings, setSettings, start, back }) {
  const [touched, setTouched] = useState(false);
  const names = settings.players.map((p) => p.name.trim().toLowerCase());
  const invalid = settings.players.some((p) => !p.name.trim()) || new Set(names).size !== names.length;
  const adjustCount = (next) => {
    if (next < 2 || next > 20) return;
    setSettings((s) => ({
      ...s,
      playerCount: next,
      players: next > s.players.length
        ? [...s.players, ...freshPlayers(next - s.players.length).map((p, index) => ({ ...p, name: `Player ${s.players.length + index + 1}`, color: colors[(s.players.length + index) % colors.length] }))]
        : s.players.slice(0, next),
    }));
  };
  return <Shell><section className="setup page">
    <button className="back" onClick={back}><ChevronLeft size={17}/> Home</button>
    <div className="section-heading"><span className="eyebrow"><Users size={15}/> Game lobby</span><h2>Set the table.</h2><p>Invite the crew and make the rules yours.</p></div>
    <div className="setup-grid">
      <div className="glass panel players-panel">
        <div className="label-row">
          <label>Players</label>
          <div className="counter">
            <button aria-label="Remove player" onClick={() => adjustCount(settings.playerCount - 1)}><ChevronLeft size={16}/></button>
            <strong>{settings.playerCount}</strong>
            <button aria-label="Add player" onClick={() => adjustCount(settings.playerCount + 1)}><ChevronRight size={16}/></button>
          </div>
        </div>
        <div className="player-list">
          {settings.players.map((player, i) => {
            const error = touched && (!player.name.trim() || names.indexOf(player.name.trim().toLowerCase()) !== i) && (!player.name.trim() ? 'Required' : 'Duplicate');
            return <div className="player-card" key={player.id} style={{ '--player-color': player.color }}>
              <span className="player-card-index">{i + 1}</span>
              <Avatar player={player}/>
              <input className="player-card-input" aria-label={`Player ${i + 1} name`} value={player.name} maxLength={24} placeholder={`Player ${i + 1}`} onChange={(e) => setSettings((s) => ({ ...s, players: s.players.map((p) => p.id === player.id ? { ...p, name: e.target.value } : p) }))}/>
              {error && <span className="field-error">{error}</span>}
            </div>;
          })}
        </div>
      </div>
      <div className="settings-stack">
        <div className="glass panel">
          <div className="label-row">
            <div><label>Duplicate answers</label><small>Shared ideas earn 5 points</small></div>
            <button className={`toggle ${settings.duplicatesAllowed ? 'on' : ''}`} aria-pressed={settings.duplicatesAllowed} onClick={() => setSettings((s) => ({ ...s, duplicatesAllowed: !s.duplicatesAllowed }))}><span/></button>
          </div>
        </div>
        <div className="glass panel">
          <label>Round timer</label>
          <div className="choice-row">{[0, 30, 60, 90].map((value) => <button className={settings.timer === value ? 'selected' : ''} onClick={() => setSettings((s) => ({ ...s, timer: value }))} key={value}>{value ? `${value}s` : 'None'}</button>)}</div>
        </div>
        <div className="glass panel">
          <label>Rounds</label>
          <div className="choice-row">{[3, 5, 10].map((value) => <button className={settings.rounds === value ? 'selected' : ''} onClick={() => setSettings((s) => ({ ...s, rounds: value }))} key={value}>{value}</button>)}</div>
        </div>
        <div className="glass panel">
          <label>Theme</label>
          <div className="theme-picker">
            {THEMES.map((t) => <button key={t.key} className={`theme-card ${settings.theme === t.key ? 'selected' : ''}`} onClick={() => setSettings((s) => ({ ...s, theme: t.key }))}><b>{t.name}</b><small>{t.tag}</small></button>)}
          </div>
          <div className="preview-cats">{getCategories(settings.theme).map((c) => <div className="preview-cat" key={c.key}><span>{c.icon}</span><b>{c.label}</b></div>)}</div>
        </div>
      </div>
      <div className="lobby-summary">
        <div className="lobby-summary-item"><span>Rounds</span><b>{settings.rounds}</b></div>
        <div className="lobby-summary-item"><span>Timer</span><b>{settings.timer ? `${settings.timer}s` : 'Free'}</b></div>
        <div className="lobby-summary-item"><span>Players</span><b>{settings.playerCount}</b></div>
      </div>
      <p className={`ready-note ${valid ? 'ready' : ''}`}>{valid ? 'Ready to play.' : 'Give every player a unique name to begin.'}</p>
      <Button className="start" onClick={() => { setTouched(true); if (valid) start(); }}>START GAME <ArrowRight size={18}/></Button>
    </div>
  </section></Shell>;
}

function Reveal({ letter, finish }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState('A');
  useEffect(() => { sounds.reveal(); }, []);
  useEffect(() => {
    if (reduce) { setShown(letter); const end = setTimeout(finish, 850); return () => clearTimeout(end); }
    let i = 0;
    let t = null;
    const step = () => {
      setShown(LETTERS[Math.floor(Math.random() * 26)]);
      i++;
      if (i > 24) { setShown(letter); t = setTimeout(finish, 1050); return; }
      t = setTimeout(step, i < 14 ? 55 : 105);
    };
    t = setTimeout(step, 55);
    return () => clearTimeout(t);
  }, [letter, finish, reduce]);
  return <Shell><section className="reveal">
    <p className="eyebrow">Round begins in</p>
    <div className="letter-orbit"><span/><span/><motion.div initial={{ scale: 0.65, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="reveal-letter">{shown}</motion.div></div>
    <p className="your-letter">YOUR LETTER</p>
    <p className="reveal-copy">Find your best answers before the clock runs out.</p>
  </section></Shell>;
}

function Game({ game, submit, skip }) {
  const cats = getCategories(game.settings.theme);
  const [answers, setAnswers] = useState(() => Object.fromEntries(game.settings.players.map((p) => [p.id, {}])));
  const [confirm, setConfirm] = useState(false);
  const time = useTimer(game.settings.timer, true, () => submit(answers));
  const prevTime = useRef(time);
  useEffect(() => {
    if (time < prevTime.current && time > 0 && time <= 5) sounds.tick();
    prevTime.current = time;
  }, [time]);
  const answerCount = Object.values(answers).flatMap(Object.values).filter(Boolean).length;
  return <Shell><section className="game page">
    <header className="game-header">
      <div><span className="eyebrow">Round {game.round} / {game.settings.rounds}</span><h2>LETTER<b>{game.letter}</b></h2></div>
      {game.settings.timer ? <div className="timer-chip"><TimerRing time={time} total={game.settings.timer}/><span className="timer-chip-label">Seconds<br/>left</span></div> : <div className="timer-open"><Check size={15}/> No timer</div>}
    </header>
    <div className="players-tabs">{game.settings.players.map((p) => <div className="player-chip" key={p.id}><Avatar player={p} small/><span>{p.name}</span></div>)}</div>
    <div className="answer-boards">{game.settings.players.map((player) => <article className="answer-board glass" key={player.id}>
      <div className="board-title"><Avatar player={player}/><strong>{player.name}</strong><span>{cats.filter((cat) => answers[player.id]?.[cat.key]?.trim()).length}/{cats.length}</span></div>
      <div className="category-grid">{cats.map((cat) => {
        const value = answers[player.id]?.[cat.key] || '';
        const entered = Boolean(value.trim());
        const first = value.trim()[0]?.toLowerCase();
        const good = entered && first === game.letter.toLowerCase();
        const bad = entered && first !== game.letter.toLowerCase();
        return <label className={`answer-card ${good ? 'good' : ''} ${bad ? 'bad' : ''}`} key={cat.key}>
          <span className="answer-card-top"><span className="category-icon">{cat.icon}</span><b>{cat.label}</b><small>{cat.hint}</small></span>
          <input placeholder={`${game.letter}...`} value={value} onChange={(e) => setAnswers((a) => ({ ...a, [player.id]: { ...a[player.id], [cat.key]: e.target.value } }))}/>
          <span className={`answer-state ${bad ? 'bad' : good ? 'ok' : 'hint'}`}>
            {bad ? <><X size={11}/> Must start with {game.letter}</> : good ? <><Check size={11}/> Good start</> : <Sparkles size={11}/>}
            {!bad && !good && <em>{cat.hint}</em>}
          </span>
        </label>;
      })}</div>
    </article>)}</div>
    <footer className="game-actions">
      <button className="skip" onClick={() => setConfirm(true)}>Skip round</button>
      <span>{answerCount} answers entered</span>
      <Button onClick={() => { sounds.submit(); submit(answers); }}>SUBMIT ANSWERS <ArrowRight size={18}/></Button>
    </footer>
    {confirm && <div className="modal-wrap"><div className="modal glass">
      <button className="modal-x" onClick={() => setConfirm(false)} aria-label="Close"><X size={18}/></button>
      <h3>Skip this round?</h3>
      <p>Unfinished answers score zero. You can still see how everyone did.</p>
      <div><Button variant="quiet" onClick={() => setConfirm(false)}>Keep playing</Button><Button onClick={() => skip(answers)}>Skip round</Button></div>
    </div></div>}
  </section></Shell>;
}

function Results({ game, next, onAdjudicate }) {
  const reduce = useReducedMotion();
  const cats = getCategories(game.settings.theme);
  const players = game.players;
  const ranking = [...players].sort((a, b) => b.score - a.score);
  const leader = ranking[0];
  const [overrides, setOverrides] = useState({});
  const [resolved, setResolved] = useState([]);
  const [voting, setVoting] = useState(null);
  const [votes, setVotes] = useState({});
  const [verdicts, setVerdicts] = useState({});

  useEffect(() => { sounds.correct(); }, []);
  useEffect(() => { if (voting) sounds.challenge(); }, [voting]);

  const challengeable = [];
  players.forEach((p) => cats.forEach((cat) => {
    const a = p.result.answers[cat.key];
    const keyId = `${p.id}:${cat.key}`;
    if (a && !a.valid && a.value && a.value.trim() && typeof a.reason === 'string' && a.reason.includes("couldn't recognize")) {
      challengeable.push({ keyId, playerId: p.id, catKey: cat.key, label: cat.label, value: a.value, normalized: a.normalized });
    }
  }));
  const pending = challengeable.filter((ch) => !resolved.includes(ch.keyId));

  const others = voting ? players.filter((p) => p.id !== voting.playerId) : [];
  const allVoted = Boolean(voting) && others.every((p) => votes[p.id]);

  const decide = () => {
    if (!voting || !allVoted) return;
    const validCount = others.filter((p) => votes[p.id] === 'valid').length;
    const invalidCount = others.filter((p) => votes[p.id] === 'invalid').length;
    const accepted = validCount > invalidCount;
    const nextOverrides = accepted ? { ...overrides, [voting.catKey]: { ...overrides[voting.catKey], [voting.normalized]: true } } : overrides;
    setOverrides(nextOverrides);
    if (accepted) onAdjudicate(nextOverrides);
    setVerdicts((v) => ({ ...v, [voting.keyId]: { accepted, validCount, invalidCount } }));
    setResolved((r) => [...r, voting.keyId]);
    setVoting(null);
    setVotes({});
  };

  const container = { hidden: {}, show: { transition: reduce ? {} : { staggerChildren: 0.07 } } };
  const item = reduce ? {} : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return <Shell><section className="results page">
    <div className="section-heading centered"><span className="eyebrow"><Check size={15}/> Round {game.round} complete</span><h2>{leader.name} takes the round.</h2><p>{leader.lastScore} points on the board.</p></div>
    {pending.length > 0 && <div className="results-banner"><Gavel size={14}/> {pending.length} answer{pending.length === 1 ? '' : 's'} couldn't be recognized — challenge one on its card to let the table decide.</div>}
    <motion.div className="results-list" variants={container} initial="hidden" animate="show">
      {players.map((player) => <motion.article variants={item} className="result-card glass" key={player.id}>
        <div className="result-player">
          <Avatar player={player}/>
          <div><strong>{player.name}</strong><small>+{player.lastScore} this round</small></div>
          <b className={`score ${player === leader ? 'leader' : ''}`}>{player.score}</b>
        </div>
        <div className="result-answers">{cats.map((cat) => {
          const result = player.result.answers[cat.key];
          const keyId = `${player.id}:${cat.key}`;
          const ch = pending.find((x) => x.keyId === keyId);
          const v = verdicts[keyId];
          const label = result.valid ? (result.challenged ? (result.duplicate ? 'Upheld · 5' : 'Upheld · 10') : result.duplicate ? 'Duplicate · 5' : 'Valid · 10') : v ? (v.accepted ? 'Upheld by vote' : `Rejected · ${v.validCount}-${v.invalidCount}`) : (result.reason || '0 pts');
          return <div className={`result-answer ${result.valid ? 'valid' : 'invalid'}`} key={cat.key}><span>{cat.label}</span><b>{result.value || '—'}</b><em>{label}</em>{ch && <span className="challenge-box"><button className="challenge-chip" onClick={() => { setVoting(ch); setVotes({}); }}><Gavel size={11}/> Challenge</button></span>}</div>;
        })}</div>
      </motion.article>)}
    </motion.div>
    <Button className="next" onClick={next}>{game.round === game.settings.rounds ? 'SEE FINAL SCORES' : 'NEXT ROUND'} <ArrowRight size={18}/></Button>
  </section>
  {voting && <div className="modal-wrap"><div className="modal glass">
    <button className="modal-x" onClick={() => { setVoting(null); setVotes({}); }} aria-label="Close"><X size={18}/></button>
    <h3>Challenge answer</h3>
    <p>“{voting.value}” as a {voting.label.toLowerCase()}? The table decides — a tie rejects it.</p>
    <div className="vote-list">{others.map((voter) => <div className="vote-row" key={voter.id}><Avatar player={voter} small/><span>{voter.name}</span><div className="vote-options"><button className={`valid ${votes[voter.id] === 'valid' ? 'on' : ''}`} onClick={() => setVotes((v) => ({ ...v, [voter.id]: 'valid' }))}>Valid</button><button className={`invalid ${votes[voter.id] === 'invalid' ? 'on' : ''}`} onClick={() => setVotes((v) => ({ ...v, [voter.id]: 'invalid' }))}>Invalid</button></div></div>)}</div>
    <p className="judge-note">The challenger ({players.find((p) => p.id === voting.playerId)?.name}) always votes valid.</p>
    <div className="modal-actions"><Button variant="quiet" onClick={() => { setVoting(null); setVotes({}); }}>Cancel</Button><Button onClick={decide} disabled={!allVoted}>{allVoted ? 'Finalize vote' : 'Votes pending…'}</Button></div>
  </div></div>}</Shell>;
}

function Final({ game, playAgain, newGame, onStats }) {
  const cats = getCategories(game.settings.theme);
  const players = [...game.players].sort((a, b) => b.score - a.score);
  const winner = players[0];
  const tied = players.length > 1 && winner.score === players[1].score;
  useEffect(() => { sounds.win(); }, []);
  const bestRound = game.roundLog.reduce((best, r) => Math.max(best, r.results.reduce((s, x) => s + x.total, 0)), 0);
  const validAnswers = game.roundLog.reduce((s, r) => s + r.results.reduce((a, x) => a + Object.values(x.answers).filter((ans) => ans?.points > 0).length, 0), 0);
  return <Shell><section className="final page">
    <div className="confetti" aria-hidden="true">✦ ✧ ● ✦ · ✧ ●</div>
    <Crown size={42} className="crown"/>
    <span className="eyebrow">Game complete</span>
    <h2>{tied ? "It's a tie!" : winner.name}</h2>
    <p className="winner-label">{tied ? 'TABLE IS TIED' : 'WINS THE TABLE'}</p>
    <div className="winner-score">{winner.score}<span>points</span></div>
    <div className="ranking glass">{players.map((p, i) => <div key={p.id} className={i === 0 ? 'first' : ''}><span>{i + 1}</span><Avatar player={p} small/><b>{p.name}</b><strong>{p.score}</strong></div>)}</div>
    <div className="final-stats">
      <div className="final-stat"><span>Best round</span><b>{bestRound}</b></div>
      <div className="final-stat"><span>Valid answers</span><b>{validAnswers}</b></div>
      <div className="final-stat"><span>Timer</span><b>{game.settings.timer ? `${game.settings.timer}s` : 'Free'}</b></div>
    </div>
    <p className="game-meta">{game.settings.rounds} rounds · {THEMES.find((t) => t.key === game.settings.theme)?.name || 'Classic'} theme · {game.settings.players.length * game.settings.rounds * cats.length} possible answers</p>
    <div className="final-actions"><Button onClick={playAgain}><RotateCcw size={17}/> PLAY AGAIN</Button><Button variant="quiet" onClick={onStats}><BarChart3 size={17}/> SCOREBOARD</Button><Button variant="quiet" onClick={newGame}>NEW GAME</Button></div>
  </section></Shell>;
}

function GameDetail({ entry, onClose }) {
  const cats = getCategories(entry.theme);
  const sorted = [...entry.players].sort((a, b) => b.score - a.score);
  const byId = Object.fromEntries(entry.players.map((p) => [p.id, p]));
  return <div className="modal-wrap"><div className="modal glass wide">
    <button className="modal-x" onClick={onClose} aria-label="Close"><X size={18}/></button>
    <h3>Game recap</h3>
    <p className="detail-meta">{new Date(entry.date).toLocaleString()} · {entry.settings.playerCount} players · {entry.settings.rounds} rounds · {THEMES.find((t) => t.key === entry.theme)?.name || 'Classic'} theme</p>
    <div className="detail-ranking">{sorted.map((p, i) => <div key={p.id} className={i === 0 && entry.winnerId ? 'first' : ''}><span>{i + 1}</span><Avatar player={p} small/><b>{p.name}</b><strong>{p.score}</strong></div>)}</div>
    <div className="detail-rounds">{entry.perRound.map((round) => <div className="detail-round" key={round.round}>
      <div className="detail-round-head"><span className="eyebrow">Round {round.round}</span><b>{round.letter}</b></div>
      <div className="detail-round-grid">{round.players.map((pr) => { const p = byId[pr.playerId]; const colored = { ...p, name: p?.name || 'Player', color: p?.color || '#A78BFA' }; return <div className="detail-round-player" key={pr.playerId}><Avatar player={colored} small/><span>{colored.name}</span><strong>+{pr.total}</strong></div>; })}</div>
      {cats.map((cat) => <div className="detail-round-answers" key={cat.key}><em>{cat.label}</em><span>{round.players.map((pr) => { const a = pr.answers?.[cat.key]; const p = byId[pr.playerId]; if (!a || !a.value) return null; return <i key={pr.playerId} className={a.valid ? '' : 'bad'} title={`${p?.name}: ${a.value} (${a.points})`}>{p?.name}: {a.value} {a.points > 0 ? `+${a.points}` : '· 0'}</i>; })}</span></div>)}
    </div>)}</div>
  </div></div>;
}

function Stats({ history, onBack, onPlay, onClear }) {
  const stats = useMemo(() => computeStats(history), [history]);
  const [openId, setOpenId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const open = useMemo(() => history.find((g) => g.id === openId) || null, [history, openId]);
  const top = stats.players[0];
  const status = stats.players.length ? { points: stats.players.reduce((s, p) => s + p.points, 0), wins: stats.players.reduce((s, p) => s + p.wins, 0) } : null;
  return <Shell><section className="stats page">
    <button className="back" onClick={onBack}><ChevronLeft size={17}/> Home</button>
    <div className="section-heading"><span className="eyebrow"><BarChart3 size={15}/> Game history</span><h2>The scoreboard.</h2><p>Every match played on this device, remembered.</p></div>
    {stats.games === 0 ? <div className="empty-state glass"><Sparkles size={26}/><h3>No games yet</h3><p>Finish your first match and your stats will start appearing here.</p><Button onClick={onPlay}>START GAME <ArrowRight size={18}/></Button></div> : <>
      <div className="stat-chips">
        <div className="stat-chip glass"><span>Games</span><b>{stats.games}</b></div>
        <div className="stat-chip glass"><span>Players</span><b>{stats.players.length}</b></div>
        <div className="stat-chip glass"><span>Top player</span><b className="chip-name">{top ? top.name : '—'}</b></div>
      </div>
      <div className="player-stats-grid">{stats.players.map((p, i) => {
        const avgScore = p.games ? Math.round(p.points / p.games) : 0;
        return <article className="player-stat-card glass" key={p.id}>
          <div className="stat-head"><Avatar player={p}/><div><strong>{p.name}</strong><small>{p.wins} win{p.wins === 1 ? '' : 's'} · {p.winRate}% win rate</small></div>{i < 3 && <span className="medal" style={{ color: medalTone[i] }} title={i === 0 ? 'Leader' : i === 1 ? 'Runner-up' : 'Bronze'}><Medal size={18}/></span>}<b className="score">{p.points}</b></div>
          <div className="stat-numbers">
            <div><span>Games</span><b>{p.games}</b></div>
            <div><span>Best round</span><b>{p.bestRound}</b></div>
            <div><span>Avg / round</span><b>{avgScore}</b></div>
            <div><span>Perfect</span><b>{p.totalRounds ? `${Math.round((p.perfectRounds / p.totalRounds) * 100)}%` : '—'}</b></div>
          </div>
          <div className="cat-bars">{Object.entries(p.categories).map(([catKey, cat]) => { const rate = cat.answered ? Math.round((cat.scored / cat.answered) * 100) : 0; const def = CATEGORY_DEFS[catKey]; return <div className="cat-bar-row" key={catKey}><span>{def?.label || catKey}</span><div className="cat-bar"><i style={{ width: `${rate}%` }}/></div><b>{cat.scored}/{cat.answered}</b></div>; })}</div>
        </article>;
      })}</div>
      <div className="history-card glass">
        <div className="history-head"><div><label>Recent games</label><small>Tap a game for the full round-by-round breakdown.</small></div><button className="clear-btn" onClick={() => setConfirmClear(true)}><Trash2 size={15}/> Clear history</button></div>
        <div className="recent-list">{stats.recent.map((g) => { const sorted = [...g.players].sort((a, b) => b.score - a.score); const win = g.winnerId ? g.players.find((p) => p.id === g.winnerId) : null; return <button className="recent-row" key={g.id} onClick={() => setOpenId(g.id)}><div className="recent-date">{new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><div className="recent-players">{sorted.map((p) => <span key={p.id}><i style={{ background: p.color }}/>{p.name} · {p.score}</span>)}</div>{win && <div className="recent-winner"><Crown size={13}/> {win.name}</div>}<ChevronRight size={16}/></button>; })}</div>
      </div>
      {status && status.points > 0 && <p className="ready-note">{stats.players.length} player{stats.players.length === 1 ? '' : 's'} · {status.points} total points · {status.wins} wins</p>}
    </>}
    {open && <GameDetail entry={open} onClose={() => setOpenId(null)}/>}
    {confirmClear && <div className="modal-wrap"><div className="modal glass">
      <button className="modal-x" onClick={() => setConfirmClear(false)} aria-label="Close"><X size={18}/></button>
      <h3>Clear history?</h3>
      <p>All {stats.games} recorded game{stats.games === 1 ? '' : 's'} will be permanently deleted.</p>
      <div><Button variant="quiet" onClick={() => setConfirmClear(false)}>Keep them</Button><Button onClick={() => { onClear(); setConfirmClear(false); }}>Clear history</Button></div>
    </div></div>}
  </section></Shell>;
}

export default function App() {
  const [settings, setSettings] = useState(readSaved);
  const [history, setHistory] = useState(() => load(KEYS.HISTORY, []));
  const [stage, setStage] = useState('home');
  const [game, setGame] = useState(null);
  const [muted, setMuted] = useState(false);
  const submittedRef = useRef(null);

  useEffect(() => { setSoundMuted(load(KEYS.SOUND, false)); setMuted(load(KEYS.SOUND, false)); }, []);
  useEffect(() => { setSoundMuted(muted); save(KEYS.SOUND, muted); }, [muted]);
  useEffect(() => save(KEYS.SETTINGS, settings), [settings]);
  useEffect(() => save(KEYS.HISTORY, history), [history]);

  const start = () => {
    submittedRef.current = null;
    const next = { settings, round: 1, letter: randomLetter([]), used: [], roundLog: [], players: settings.players.map((p) => ({ ...p, score: 0, lastScore: 0 })) };
    setGame(next);
    setStage('reveal');
  };
  const submit = (answers) => {
    if (stage !== 'game' || !game || submittedRef.current === game.round) return;
    submittedRef.current = game.round;
    const scored = scoreRound({ players: game.players, answers, letter: game.letter, duplicatesAllowed: game.settings.duplicatesAllowed, categories: getCategories(game.settings.theme) });
    setGame((g) => {
      const players = g.players.map((p, i) => ({ ...p, result: scored[i], lastScore: scored[i].total, score: p.score + scored[i].total }));
      const roundLog = [...(g.roundLog || []), { round: g.round, letter: g.letter, answers, results: scored }];
      return { ...g, players, roundLog };
    });
    setStage('results');
  };
  const adjudicate = (overrides) => setGame((g) => {
    const last = g.roundLog?.[g.roundLog.length - 1];
    if (!last) return g;
    const scored = scoreRound({ players: g.players, answers: last.answers, letter: last.letter, duplicatesAllowed: g.settings.duplicatesAllowed, categories: getCategories(g.settings.theme), overrides });
    const players = g.players.map((p, i) => ({ ...p, result: scored[i], lastScore: scored[i].total, score: p.score - p.lastScore + scored[i].total }));
    const roundLog = [...g.roundLog.slice(0, -1), { ...last, results: scored }];
    return { ...g, players, roundLog };
  });
  const next = () => {
    if (game.round >= game.settings.rounds) { setHistory((h) => recordGame(h, game)); setStage('final'); return; }
    setGame((g) => ({ ...g, round: g.round + 1, used: [...g.used, g.letter], letter: randomLetter([...g.used, g.letter]) }));
    setStage('reveal');
  };
  const newGame = () => { setGame(null); setStage('setup'); };
  const goStats = () => setStage('stats');
  const hideSound = ['game', 'reveal'].includes(stage);

  return <>
    {!hideSound && <button className="sound-toggle" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>}
    <AnimatePresence mode="wait">
      {stage === 'home' && <Landing key="home" begin={() => setStage('setup')} onStats={goStats} history={history}/>}
      {stage === 'setup' && <Setup key="setup" settings={settings} setSettings={setSettings} start={start} back={() => setStage('home')}/>}
      {stage === 'reveal' && <Reveal key="reveal" letter={game.letter} finish={() => setStage('game')}/>}
      {stage === 'game' && <Game key={`game-${game.round}`} game={game} submit={submit} skip={submit}/>}
      {stage === 'results' && <Results key="results" game={game} next={next} onAdjudicate={adjudicate}/>}
      {stage === 'final' && <Final key="final" game={game} playAgain={start} newGame={newGame} onStats={goStats}/>}
      {stage === 'stats' && <Stats key="stats" history={history} onBack={() => setStage('home')} onPlay={() => setStage('setup')} onClear={() => setHistory([])}/>}
    </AnimatePresence>
  </>;
}