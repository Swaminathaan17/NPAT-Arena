import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Crown, Flame, Gavel, Lock, Medal, RotateCcw, Shield, Sparkles, Target, Trash2, TrendingUp, Trophy, Unlock, User, Users, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { CATEGORY_DEFS, LETTERS, MODES, PLAYER_COLORS, ROUND_OPTIONS, SCORING_PROFILES, THEMES, TIMER_OPTIONS, computeHighlights, getCategories, randomLetter, roundWinnerId, sanitizeSettings, scoreExplanation, scoreRound, standingsAfter, suddenDeathEnd } from './game/game';
import { KEYS, load, loadSettings, save } from './utils/storage';
import { MAX_GAMES, computeCareerStats, recordGame } from './game/stats';
import { ACHIEVEMENTS, mergeAchievements } from './utils/achievements';
import { setMuted as setSoundMuted, sounds } from './utils/sounds';
import Button from './components/Button';
import Avatar from './components/Avatar';
import Shell from './components/Shell';
import Modal from './components/Modal';
import RoundTimer from './components/RoundTimer';

const colors = PLAYER_COLORS;
const medalTone = ['#ffe08a', '#c8cede', '#e3a06a'];
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const freshPlayers = (count) => Array.from({ length: count }, (_, i) => ({ id: uid(), name: `Player ${i + 1}`, color: colors[i % colors.length] }));
const DEFAULT_SETTINGS = { playerCount: 2, players: freshPlayers(2), duplicatesAllowed: false, timer: 60, rounds: 5, theme: 'classic', mode: 'classic', profile: 'standard', categories: null };
const readSaved = () => sanitizeSettings({ ...DEFAULT_SETTINGS, ...loadSettings(DEFAULT_SETTINGS) });

function useStored(key, value) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    save(key, value);
  }, [key, value]);
}

const ACH_ICONS = { Trophy, Target, Zap, Sparkles, Flame, Gavel, Shield, Medal, TrendingUp };

function modeOf(key) { return MODES.find((m) => m.key === key) || MODES[0]; }

const ordinal = (n) => {
  if (n == null) return '—';
  const last = n % 100;
  const suffix = last >= 11 && last <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return `${n}${suffix}`;
};
const fmtClock = (sec) => { if (sec == null) return '—'; const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };

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
    <div className="feature-grid">{[['⚡', 'Fast rounds'], ['◎', 'Random letters'], ['✦', 'Smart scoring'], ['◌', 'Built to play together']].map(([icon, text]) => <div className="feature" key={text}><span>{icon}</span>{text}</div>)}</div>
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
  const peakMode = (mode) => setSettings((s) => ({ ...s, mode: mode.key, timer: mode.timer, profile: mode.profile }));
  const peakTheme = (theme) => setSettings((s) => ({ ...s, theme: theme.key, categories: theme.categories }));
  const toggleCat = (key) => setSettings((s) => {
    const next = s.categories.includes(key) ? s.categories.filter((k) => k !== key) : [...s.categories, key];
    return next.length ? { ...s, categories: next } : s;
  });
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
          <label>Game mode</label>
          <div className="mode-picker">
            {MODES.map((m) => <button key={m.key} className={`mode-card ${settings.mode === m.key ? 'selected' : ''}`} onClick={() => peakMode(m)}><span className="mode-icon">{m.icon}</span><b>{m.name}</b><small>{m.tag}</small><em>{m.timer ? `${m.timer}s` : 'Free'}</em></button>)}
          </div>
        </div>
        <div className="glass panel">
          <label>Scoring profile</label>
          <div className="choice-row">{[['standard', 'Balanced'], ['intense', 'High momentum']].map(([key, label]) => <button className={settings.profile === key ? 'selected' : ''} onClick={() => setSettings((s) => ({ ...s, profile: key }))} key={key}>{label}</button>)}</div>
          <small className="panel-note">Speed · unique · streak · tough-letter bonuses — bigger in High momentum.</small>
        </div>
        <div className="glass panel">
          <div className="label-row">
            <div><label>Duplicate answers</label><small>Shared ideas earn 5 points</small></div>
            <button className={`toggle ${settings.duplicatesAllowed ? 'on' : ''}`} aria-pressed={settings.duplicatesAllowed} onClick={() => setSettings((s) => ({ ...s, duplicatesAllowed: !s.duplicatesAllowed }))}><span/></button>
          </div>
        </div>
        <div className="glass panel">
          <label>Round timer</label>
          <div className="choice-row">{TIMER_OPTIONS.map((value) => <button className={settings.timer === value ? 'selected' : ''} onClick={() => setSettings((s) => ({ ...s, timer: value }))} key={value}>{value ? `${value}s` : 'None'}</button>)}</div>
        </div>
        <div className="glass panel">
          <label>Rounds</label>
          <div className="choice-row">{ROUND_OPTIONS.map((value) => <button className={settings.rounds === value ? 'selected' : ''} onClick={() => setSettings((s) => ({ ...s, rounds: value }))} key={value}>{value}</button>)}</div>
        </div>
        <div className="glass panel">
          <label>Categories</label>
          <div className="cat-toggle-grid">
            {Object.values(CATEGORY_DEFS).map((c) => <button key={c.key} className={`cat-toggle ${settings.categories.includes(c.key) ? 'on' : ''}`} aria-pressed={settings.categories.includes(c.key)} onClick={() => toggleCat(c.key)}><span>{c.icon}</span>{c.label}</button>)}
          </div>
        </div>
        <div className="glass panel">
          <label>Fast start theme</label>
          <div className="theme-picker">
            {THEMES.map((t) => <button key={t.key} className={`theme-card ${settings.theme === t.key ? 'selected' : ''}`} onClick={() => peakTheme(t)}><b>{t.name}</b><small>{t.tag}</small></button>)}
          </div>
          <div className="preview-cats">{getCategories(settings.theme, settings.categories).map((c) => <div className="preview-cat" key={c.key}><span>{c.icon}</span><b>{c.label}</b></div>)}</div>
        </div>
      </div>
      <div className="lobby-summary">
        <div className="lobby-summary-item"><span>Rounds</span><b>{settings.rounds}</b></div>
        <div className="lobby-summary-item"><span>Timer</span><b>{settings.timer ? `${settings.timer}s` : 'Free'}</b></div>
        <div className="lobby-summary-item"><span>Players</span><b>{settings.playerCount}</b></div>
        <div className="lobby-summary-item"><span>Categories</span><b>{getCategories(settings.theme, settings.categories).length}</b></div>
      </div>
      <div className="lobby-match"><span>Match preview</span><b>{settings.playerCount} Players • {modeOf(settings.mode).name} • {settings.rounds} Rounds • {settings.timer ? `${settings.timer}s` : 'No timer'}</b></div>
      <p className={`ready-note ${valid ? 'ready' : ''}`}>{valid ? 'Ready to play.' : 'Give every player a unique name to begin.'}</p>
      <Button className="start" onClick={() => { setTouched(true); if (valid) start(); }}>START GAME <ArrowRight size={18}/></Button>
    </div>
  </section></Shell>;
}

function Intro({ game, onBegin, introMs = 2400 }) {
  const reduce = useReducedMotion();
  const mode = modeOf(game.settings.mode);
  const profile = SCORING_PROFILES[game.settings.profile] || SCORING_PROFILES.standard;
  const [n, setN] = useState(3);
  const beginRef = useRef(onBegin);
  useEffect(() => { beginRef.current = onBegin; }, [onBegin]);
  useEffect(() => { sounds.roundStart(); }, []);
  useEffect(() => {
    if (reduce) { const t = setTimeout(() => beginRef.current(), 320); return () => clearTimeout(t); }
    const steplen = Math.max(340, introMs / 3);
    const timers = [];
    let count = 3;
    const fire = setInterval(() => {
      count -= 1;
      if (count <= 0) { clearInterval(fire); setN(0); timers.push(setTimeout(() => beginRef.current(), 230)); return; }
      setN(count);
    }, steplen);
    return () => { clearInterval(fire); timers.forEach(clearTimeout); };
  }, [reduce, introMs]);
  return <Shell><section className="intro page">
    <div className="section-heading centered">
      <span className="eyebrow"><Users size={15}/> Match start</span>
      <h2>Round {game.round} <span className="intro-of">of {game.settings.rounds}</span></h2>
      <p>The table is set — keys ready.</p>
    </div>
    <div className="intro-match glass">
      <div className="intro-chip-row">
        <span className="chip-soft"><b>{mode.icon}</b> {mode.name}</span>
        <span className="chip-soft">{profile.name} scoring</span>
        <span className="chip-soft"><Clock3 size={12}/> {game.settings.timer ? `${game.settings.timer}s rounds` : 'No timer'}</span>
        <span className="chip-soft"><Users size={12}/> {game.players.length} players</span>
      </div>
      <div className="intro-roster" role="list" aria-label="Matchup preview">
        {game.players.map((p, i) => <div className="intro-player" key={p.id} role="listitem"><span className="intro-rank">{i + 1}</span><Avatar player={p}/><b>{p.name}</b></div>)}
      </div>
    </div>
    <div className="intro-count" key={n} aria-live="polite">
      <motion.div initial={reduce ? false : { scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.16 }}>{n === 0 ? 'GO' : n}</motion.div>
    </div>
    <Button variant="quiet" onClick={() => beginRef.current()}>Skip intro <ArrowRight size={15}/></Button>
  </section></Shell>;
}

function Reveal({ letter, finish, fast = false }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState('A');
  useEffect(() => { sounds.reveal(); }, []);
  useEffect(() => {
    if (reduce) { setShown(letter); const end = setTimeout(finish, fast ? 550 : 850); return () => clearTimeout(end); }
    let i = 0;
    let t = null;
    const limit = fast ? 12 : 24;
    const step = () => {
      setShown(LETTERS[Math.floor(Math.random() * 26)]);
      i++;
      if (i > limit) { setShown(letter); t = setTimeout(finish, fast ? 600 : 1050); return; }
      t = setTimeout(step, fast ? 40 : (i < 14 ? 55 : 105));
    };
    t = setTimeout(step, fast ? 40 : 55);
    return () => clearTimeout(t);
  }, [letter, finish, reduce, fast]);
  return <Shell><section className="reveal">
    <p className="eyebrow">Round begins in</p>
    <div className="letter-orbit"><span/><span/><motion.div initial={{ scale: 0.65, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="reveal-letter">{shown}</motion.div></div>
    <p className="your-letter">YOUR LETTER</p>
    <p className="reveal-copy">Find your best answers before the clock runs out.</p>
  </section></Shell>;
}

function AnswerBoard({ player, cats, letter, answers, locked, lockAt, onChange, onLock }) {
  const lc = letter.toLowerCase();
  const filled = cats.filter((cat) => answers[cat.key]?.trim()).length;
  return <article className="answer-board glass">
    <div className="board-title"><Avatar player={player}/><strong>{player.name}</strong><span>{filled}/{cats.length}</span></div>
    <div className="category-grid">{cats.map((cat) => {
      const value = answers[cat.key] || '';
      const entered = Boolean(value.trim());
      const first = value.trim()[0]?.toLowerCase();
      const good = entered && first === lc;
      const bad = entered && first !== lc;
      return <label className={`answer-card ${good ? 'good' : ''} ${bad ? 'bad' : ''} ${locked ? 'locked' : ''}`} key={cat.key}>
        <span className="answer-card-top"><span className="category-icon">{cat.icon}</span><b>{cat.label}</b><small>{cat.hint}</small></span>
        <input placeholder={`${letter}...`} value={value} disabled={locked} onChange={(e) => {
          const next = e.target.value;
          const wasGood = entered && first === lc;
          const isGood = Boolean(next.trim()) && next.trim()[0]?.toLowerCase() === lc;
          if (isGood && !wasGood) sounds.valid();
          else if (!isGood && wasGood) sounds.wrong();
          onChange(player.id, cat.key, next);
        }}/>
        <span className={`answer-state ${bad ? 'bad' : good ? 'ok' : 'hint'}`}>
          {bad ? <><X size={11}/> Must start with {letter}</> : good ? <><Check size={11}/> Good start</> : <Sparkles size={11}/>}
          {!bad && !good && <em>{cat.hint}</em>}
        </span>
      </label>;
    })}</div>
    <div className="board-lock">
      <button className={`lock-btn ${locked ? 'active' : ''}`} aria-pressed={locked} onClick={() => onLock(player.id, locked)}>{locked ? <><Unlock size={14}/> Unlock</> : <><Lock size={14}/> Lock answers</>}{locked && lockAt != null && <em>{lockAt}s ready</em>}</button>
    </div>
  </article>;
}
const MemoBoard = memo(AnswerBoard);

function Game({ game, submit, skip }) {
  const cats = game.cats || getCategories(game.settings.theme, game.settings.categories);
  const players = game.players;
  const [answers, setAnswers] = useState(() => Object.fromEntries(players.map((p) => [p.id, {}])));
  const [locks, setLocks] = useState({});
  const [confirm, setConfirm] = useState(false);
  const answersRef = useRef(answers);
  const locksRef = useRef(locks);
  const lockTimeRef = useRef(null);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { locksRef.current = locks; }, [locks]);

  const active = useMemo(() => players.filter((p) => !game.alive || game.alive.includes(p.id)), [players, game.alive]);
  const standings = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const leader = standings[0];
  const submitNow = useCallback(() => { sounds.submit(); submit(answersRef.current, locksRef.current); }, [submit]);
  const lockedCount = active.filter((p) => locks[p.id] !== undefined).length;
  const leaveTick = useCallback((n) => { lockTimeRef.current = n; }, []);
  const handleChange = useCallback((playerId, catKey, value) => {
    setAnswers((a) => ({ ...a, [playerId]: { ...a[playerId], [catKey]: value } }));
  }, []);
  const handleLock = useCallback((playerId, wasLocked) => {
    sounds.pop();
    setLocks((l) => {
      if (wasLocked) { const n = { ...l }; delete n[playerId]; return n; }
      return { ...l, [playerId]: lockTimeRef.current ?? game.settings.timer ?? 0 };
    });
  }, [game.settings.timer]);
  useEffect(() => {
    if (active.length && lockedCount === active.length && Object.keys(locks).length) submitNow();
  }, [lockedCount, active.length, submitNow]);
  const answerCount = active.reduce((sum, p) => sum + Object.values(answers[p.id] || {}).filter(Boolean).length, 0);
  const mode = modeOf(game.settings.mode);
  return <Shell><section className="game page">
    <header className="game-header">
      <div><span className="eyebrow">Round {game.round} / {game.settings.rounds}</span><h2>LETTER<b>{game.letter}</b></h2></div>
      {game.settings.timer ? <RoundTimer total={game.settings.timer} active={Boolean(game.settings.timer)} onComplete={submitNow} onTick={leaveTick}/> : <div className="timer-open"><Check size={15}/> No timer</div>}
    </header>
    <div className="game-chips">
      <span className="chip-soft"><b>{mode.icon}</b> {mode.name}</span>
      <span className="chip-soft">{SCORING_PROFILES[game.settings.profile]?.name || 'Balanced'} scoring</span>
      <span className="chip-soft"><Users size={12}/> {active.length} active</span>
      <span className="chip-soft">{game.settings.timer ? '⏱ Lock to lock in your speed bonus' : 'Free play — no clock'}</span>
    </div>
    <div className="standings-strip" role="list" aria-label="Live standings">
      {standings.map((p, i) => {
        const out = !active.some((a) => a.id === p.id);
        return <div className={`stand-row ${p.id === leader?.id ? 'lead' : ''} ${out ? 'out' : ''}`} role="listitem" key={p.id}>
          <span className="stand-rank">{i + 1}</span>
          <Avatar player={p} small/>
          <span className="stand-name">{p.name}</span>
          {p.id === leader?.id && <Crown size={12} className="stand-crown" aria-hidden="true"/>}
          {p.streak > 0 && <span className="chip-streak" title={`${p.streak} streak`}><Flame size={11}/> {p.streak}</span>}
          <b className="stand-score">{p.score}</b>
        </div>;
      })}
    </div>
    <div className="answer-boards">{active.map((player) => {
      const locked = locks[player.id] !== undefined;
      return <MemoBoard key={player.id} player={player} cats={cats} letter={game.letter} answers={answers[player.id]} locked={locked} lockAt={locks[player.id]} onChange={handleChange} onLock={handleLock}/>;
    })}</div>
    <footer className="game-actions">
      <button className="skip" onClick={() => setConfirm(true)}>Skip round</button>
      <span>{answerCount} answers entered{Object.keys(locks).length ? ` · ${lockedCount} locked` : ''}</span>
      <Button onClick={submitNow}>SUBMIT ANSWERS <ArrowRight size={18}/></Button>
    </footer>
    {confirm && <Modal title="Skip this round?" onClose={() => setConfirm(false)}>
      <p>Unfinished answers score zero. You can still see how everyone did.</p>
      <div><Button variant="quiet" onClick={() => setConfirm(false)}>Keep playing</Button><Button onClick={() => { sounds.submit(); skip(answers, locks); }}>Skip round</Button></div>
    </Modal>}
  </section></Shell>;
}

function Breakdown({ answer }) {
  if (!answer || !answer.valid) return null;
  const { parts, total } = scoreExplanation(answer);
  if (!parts.length) return <em className="result-note">0 pts</em>;
  return <em className="result-note">{parts.map((p) => `${p.value} ${p.label}`).join(' + ')} = {total}</em>;
}

function roundWhy(answers) {
  const order = ['Base', 'Duplicate', 'Unique', 'Speed', 'Bonus', 'Streak'];
  const totals = {};
  Object.values(answers || {}).forEach((a) => {
    if (!a) return;
    scoreExplanation(a).parts.forEach((p) => { totals[p.label] = (totals[p.label] || 0) + p.value; });
  });
  const bits = order.filter((label) => totals[label]).map((label) => `${totals[label]} ${label.toLowerCase()}`);
  return bits.length ? `Score: ${bits.join(' · ')}` : null;
}

function Results({ game, next, onAdjudicate }) {
  const reduce = useReducedMotion();
  const cats = game.cats || getCategories(game.settings.theme, game.settings.categories);
  const players = game.players;
  const log = game.roundLog || [];
  const current = [...players].sort((a, b) => b.score - a.score);
  const leader = current[0];
  const prior = standingsAfter(log, game.round - 1);
  const leaderBefore = prior[0]?.playerId || null;
  const last = log[log.length - 1] || null;
  const timings = last?.timings || {};
  const dead = last?.dead || [];
  const totals = Object.fromEntries((last?.results || []).map((r) => [r.playerId, r.total]));
  const shown = players.filter((p) => totals[p.id] !== undefined);
  const roundWinner = (() => { const rid = (last?.results || []).find((r) => r.roundWinner)?.playerId; return players.find((p) => p.id === rid) || null; })();
  const biggest = shown.map((p) => ({ player: p, total: totals[p.id] || 0 })).sort((a, b) => b.total - a.total)[0] || null;
  const fastest = shown
    .filter((p) => p.result && Object.values(p.result.answers || {}).some((a) => a && a.valid))
    .map((p) => ({ player: p, t: timings[p.id] }))
    .filter((x) => typeof x.t === 'number' && Number.isFinite(x.t) && x.t >= 0)
    .sort((a, b) => a.t - b.t)[0] || null;
  const ended = Boolean(game.ended);

  const [voting, setVoting] = useState(null);
  const [votes, setVotes] = useState({});
  useEffect(() => { sounds.correct(); if (leaderBefore && leader && leaderBefore !== leader.id) sounds.move(); }, []);
  useEffect(() => { if (voting) sounds.challenge(); }, [voting]);

  const currentRankOf = (id) => { const i = current.findIndex((p) => p.id === id); return i === -1 ? null : i + 1; };
  const priorRankOf = (id) => { const i = prior.findIndex((s) => s.playerId === id); return i === -1 ? null : i + 1; };

  const challengeable = [];
  shown.forEach((p) => cats.forEach((cat) => {
    const a = p.result?.answers?.[cat.key];
    const keyId = `${p.id}:${cat.key}`;
    if (a && !a.valid && a.value && a.value.trim() && typeof a.reason === 'string' && a.reason.includes("couldn't recognize")) {
      challengeable.push({ keyId, playerId: p.id, catKey: cat.key, label: cat.label, value: a.value, normalized: a.normalized });
    }
  }));
  const pending = challengeable.filter((ch) => !game.verdicts?.[ch.keyId]);

  const others = voting ? shown.filter((p) => p.id !== voting.playerId) : [];
  const allVoted = Boolean(voting) && others.every((p) => votes[p.id] === 'valid' || votes[p.id] === 'invalid');

  const decide = () => {
    if (!voting || !allVoted) return;
    const validCount = others.filter((p) => votes[p.id] === 'valid').length;
    const invalidCount = others.filter((p) => votes[p.id] === 'invalid').length;
    onAdjudicate({ playerId: voting.playerId, catKey: voting.catKey, normalized: voting.normalized, accepted: validCount > invalidCount, validCount, invalidCount });
    setVoting(null);
    setVotes({});
  };

  const container = { hidden: {}, show: { transition: reduce ? {} : { staggerChildren: 0.07 } } };
  const item = reduce ? {} : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return <Shell><section className="results page">
    <div className="section-heading centered">
      <span className="eyebrow"><Check size={15}/> Round {game.round} complete</span>
      <h2>{roundWinner ? `${roundWinner.name} takes the round.` : 'The round ends tied.'}</h2>
      <p>{roundWinner ? `${roundWinner.lastScore} points this round.` : 'No one outscored anyone else.'}</p>
    </div>
    {dead.length > 0 && <div className="results-banner warn" role="status"><Flame size={14}/> {dead.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean).join(', ')} scored 0 — out of the sudden death!</div>}
    {pending.length > 0 && <div className="results-banner"><Gavel size={14}/> {pending.length} answer{pending.length === 1 ? '' : 's'} couldn't be recognized — challenge one on its card to let the table decide.</div>}
    <div className="round-highlights">
      {roundWinner && <span><Crown size={12}/> {roundWinner.name} wins{roundWinner.streak >= 2 ? ` — ${roundWinner.streak} in a row` : ''}</span>}
      {biggest && <span><Zap size={12}/> Biggest gain: {biggest.player.name} +{biggest.total}</span>}
      {fastest && <span><Clock3 size={12}/> Fastest valid: {fastest.player.name} — {fastest.t}s</span>}
      {!roundWinner && <span><Crown size={12}/> Round tie — streak frozen</span>}
    </div>
    <motion.div className="results-list" variants={container} initial="hidden" animate="show">
      {shown.map((player) => {
        const nowRank = currentRankOf(player.id);
        const fromRank = priorRankOf(player.id);
        const delta = fromRank == null || nowRank == null ? 0 : nowRank - fromRank;
        const why = roundWhy(player.result?.answers);
        return <motion.article variants={item} className="result-card glass" key={player.id}>
          <div className="result-player">
            <Avatar player={player}/>
            <div><strong>{player.name}</strong><small>+{player.lastScore || 0} this round{player.streak > 0 ? ` · ${player.streak} streak` : ''}</small></div>
            {timings[player.id] !== undefined && <span className="time-chip">{timings[player.id]}s</span>}
            <b className={`score ${player === leader ? 'leader' : ''}`}>{player.score}</b>
          </div>
          <div className="result-rankline">
            <span className={`rank-badge ${nowRank === 1 ? 'first' : ''}`}>{ordinal(nowRank)}</span>
            {fromRank == null ? <span className="rank-delta flat">new</span> : delta === 0 ? <span className="rank-delta flat">—</span> : delta > 0 ? <span className="rank-delta down" aria-label={`dropped ${delta}`}>▼ {delta}</span> : <span className="rank-delta up" aria-label={`climbed ${-delta}`}>▲ {-delta}</span>}
            {why && <span className="result-why">{why}</span>}
          </div>
          <div className="result-answers">{cats.map((cat) => {
            const result = player.result?.answers?.[cat.key];
            if (!result) return null;
            const keyId = `${player.id}:${cat.key}`;
            const ch = pending.find((x) => x.keyId === keyId);
            const v = game.verdicts?.[keyId];
            const label = result.valid
              ? result.challenged ? `Upheld · ${result.points}` : result.duplicate ? `Duplicate · ${result.points}` : `Valid · ${result.points}`
              : v ? (v.accepted ? `Upheld by vote · ${result.points}` : `Rejected · ${v.validCount}-${v.invalidCount}`) : (result.reason || '0 pts');
            return <div className={`result-answer ${result.valid ? 'valid' : 'invalid'}`} key={cat.key}><span>{cat.label}</span><b>{result.value || '—'}</b><em>{label}</em><Breakdown answer={result}/>{ch && <span className="challenge-box"><button className="challenge-chip" onClick={() => { setVoting(ch); setVotes({}); }}><Gavel size={11}/> Challenge</button></span>}</div>;
          })}</div>
        </motion.article>;
      })}
    </motion.div>
    <Button className="next" onClick={next}>{ended || game.round === game.settings.rounds ? 'SEE FINAL SCORES' : 'NEXT ROUND'} <ArrowRight size={18}/></Button>
  </section>
  {voting && <Modal title="Challenge answer" onClose={() => { setVoting(null); setVotes({}); }}>
    <p>“{voting.value}” as a {voting.label.toLowerCase()}? The table decides — a tie rejects it.</p>
    <div className="vote-list">{others.map((voter) => <div className="vote-row" key={voter.id}><Avatar player={voter} small/><span>{voter.name}</span><div className="vote-options"><button className={`valid ${votes[voter.id] === 'valid' ? 'on' : ''}`} onClick={() => setVotes((v) => ({ ...v, [voter.id]: 'valid' }))}>Valid</button><button className={`invalid ${votes[voter.id] === 'invalid' ? 'on' : ''}`} onClick={() => setVotes((v) => ({ ...v, [voter.id]: 'invalid' }))}>Invalid</button></div></div>)}</div>
    <p className="judge-note">The challenger ({players.find((p) => p.id === voting.playerId)?.name}) always votes valid.</p>
    <div className="modal-actions"><Button variant="quiet" onClick={() => { setVoting(null); setVotes({}); }}>Cancel</Button><Button onClick={decide} disabled={!allVoted}>{allVoted ? 'Finalize vote' : 'Votes pending…'}</Button></div>
  </Modal>}</Shell>;
}

function describeHighlight(h) {
  switch (h.key) {
    case 'fastest': return `${h.value}s`;
    case 'biggest': return `+${h.value} pts`;
    case 'comeback': return `Round ${h.round}`;
    case 'streak': return `${h.value} in a row`;
    case 'unique': return `${h.value} answers`;
    case 'challenge': return `${h.value} won`;
    case 'toughLetter': return `Letter ${h.value}`;
    default: return `${h.value}`;
  }
}

function Final({ game, playAgain, newGame, onStats, history, setHistory, achievements, setAchievements }) {
  const players = [...game.players].sort((a, b) => b.score - a.score);
  const survivor = game.survivorId ? players.find((p) => p.id === game.survivorId) || null : null;
  const sdEnded = game.mode === 'sudden-death' && game.ended;
  const massTie = sdEnded && !game.survivorId;
  const rankedTie = !survivor && players.length > 1 && players[0].score === players[1].score;
  const tied = massTie || rankedTie;
  const winner = survivor || players[0];
  const mode = modeOf(game.settings.mode);
  const highlights = useMemo(() => computeHighlights(game), [game]);
  const [meta, setMeta] = useState(null);
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    if (tied) sounds.tie(); else sounds.win();
    const dur = game.startedAt ? Math.max(0, Math.round((Date.now() - game.startedAt) / 1000)) : null;
    const entry = recordGame([], game, { durationSec: dur });
    const career = computeCareerStats([entry, ...history]);
    const merged = mergeAchievements(career, achievements);
    setAchievements(merged.stored);
    setHistory((h) => [entry, ...h].slice(0, MAX_GAMES));
    setMeta({ dur, eliminatedOrder: entry.eliminatedOrder || [], newlyUnlocked: merged.newlyUnlocked });
    if (merged.newlyUnlocked.length) sounds.achievement();
  }, []);

  const gap = players.length > 1 ? players[0].score - players[1].score : 0;
  const bestRound = game.roundLog.reduce((best, r) => Math.max(best, (r.results || []).reduce((s, x) => s + (x.total || 0), 0)), 0);
  const validAnswers = game.roundLog.reduce((s, r) => s + (r.results || []).reduce((a, x) => a + Object.values(x.answers || {}).filter((ans) => ans?.points > 0).length, 0), 0);
  const eliminatedNames = (meta?.eliminatedOrder || []).map((id) => game.players.find((p) => p.id === id)?.name).filter(Boolean);

  return <Shell><section className="final page">
    <div className="confetti" aria-hidden="true">✦ ✧ ● ✦ · ✧ ●</div>
    <Crown size={42} className="crown"/>
    <span className="eyebrow">Game complete</span>
    <h2>{tied ? "It's a tie!" : winner.name}</h2>
    <p className="winner-label">{tied ? (massTie ? 'NOBODY SURVIVED — TABLE TIE' : 'TABLE IS TIED') : survivor ? 'LAST ONE STANDING' : 'WINS THE TABLE'}</p>
    <div className="winner-score">{winner.score}<span>points</span></div>
    <div className="ranking glass">{players.map((p, i) => <div key={p.id} className={i === 0 && !tied ? 'first' : ''}><span>{i + 1}</span><Avatar player={p} small/><b>{p.name}</b><strong>{p.score}</strong></div>)}</div>
    <div className="final-stats">
      <div className="final-stat"><span>Best round</span><b>{bestRound}</b></div>
      <div className="final-stat"><span>Valid answers</span><b>{validAnswers}</b></div>
      <div className="final-stat"><span>Rounds played</span><b>{game.round}</b></div>
      <div className="final-stat"><span>Match duration</span><b>{fmtClock(meta?.dur ?? null)}</b></div>
      {!tied && gap > 0 && <div className="final-stat"><span>Winning margin</span><b>+{gap}</b></div>}
    </div>
    {sdEnded && <div className="final-section sd-box">
      <h4>Sudden death</h4>
      <p>{eliminatedNames.length > 0 ? <>Eliminated — {eliminatedNames.join(' → ')}.</> : null} {survivor ? `${survivor.name} outlasted the table.` : 'No one survived — the table is tied.'}</p>
    </div>}
    {highlights.length > 0 && <div className="final-section">
      <h4>Match highlights</h4>
      <div className="final-highlights">{highlights.map((h) => { const Icon = ACH_ICONS[h.icon] || Trophy; return <div className="highlight-card" key={h.key}><Icon size={15}/><span><b>{h.name}</b><small>{h.label} · {describeHighlight(h)}{h.round ? ` · Round ${h.round}` : ''}</small></span></div>; })}</div>
    </div>}
    {meta && meta.newlyUnlocked.length > 0 && <div className="final-section" aria-live="polite">
      <h4>New achievements</h4>
      <div className="ach-announce">{meta.newlyUnlocked.map((u) => { const Icon = ACH_ICONS[u.achievement?.icon] || Trophy; return <div className="ach-badge" key={`${u.playerKey}-${u.key}`}><Icon size={16}/><span><b>{u.achievement?.name || u.key}</b><small>{u.playerName}</small></span></div>; })}</div>
    </div>}
    <p className="game-meta">{game.round} round{game.round === 1 ? '' : 's'} · {mode.name} · {SCORING_PROFILES[game.settings.profile]?.name || 'Balanced'} · {THEMES.find((t) => t.key === game.settings.theme)?.name || 'Classic'} · {game.players.length} players</p>
    <div className="final-actions"><Button onClick={playAgain}><RotateCcw size={17}/> PLAY AGAIN</Button><Button variant="quiet" onClick={onStats}><BarChart3 size={17}/> SCOREBOARD</Button><Button variant="quiet" onClick={newGame}>NEW GAME</Button></div>
  </section></Shell>;
}

function GameDetail({ entry, onClose }) {
  const cats = getCategories(entry.theme, entry.settings?.categories || null);
  const sorted = [...entry.players].sort((a, b) => b.score - a.score);
  const byId = Object.fromEntries(entry.players.map((p) => [p.id, p]));
  const mode = MODES.find((m) => m.key === entry.mode || m.key === entry.settings?.mode) || MODES[0];
  return <Modal title="Game recap" wide onClose={onClose}>
    <p className="detail-meta">{new Date(entry.date).toLocaleString()} · {entry.settings.playerCount} players · {entry.settings.rounds} rounds · {mode.name} · {THEMES.find((t) => t.key === entry.theme)?.name || 'Classic'} categories{entry.durationSec != null ? ` · ${fmtClock(entry.durationSec)}` : ''}</p>
    <div className="detail-ranking">{sorted.map((p, i) => <div key={p.id} className={i === 0 && entry.winnerId ? 'first' : ''}><span>{i + 1}</span><Avatar player={p} small/><b>{p.name}</b><strong>{p.score}</strong></div>)}</div>
    <div className="detail-rounds">{entry.perRound.map((round) => <div className="detail-round" key={round.round}>
      <div className="detail-round-head"><span className="eyebrow">Round {round.round}</span><b>{round.letter}</b></div>
      <div className="detail-round-grid">{round.players.map((pr) => { const p = byId[pr.playerId]; const colored = { ...p, name: p?.name || 'Player', color: p?.color || '#A78BFA' }; return <div className="detail-round-player" key={pr.playerId}><Avatar player={colored} small/><span>{colored.name}</span>{round.winnerId === pr.playerId && <Crown size={11} className="round-winner-mark"/>}<strong>+{pr.total}</strong></div>; })}</div>
      {cats.map((cat) => <div className="detail-round-answers" key={cat.key}><em>{cat.label}</em><span>{round.players.map((pr) => { const a = pr.answers?.[cat.key]; const p = byId[pr.playerId]; if (!a || !a.value) return null; return <i key={pr.playerId} className={a.valid ? '' : 'bad'} title={`${p?.name}: ${a.value} (${a.points})`}>{p?.name}: {a.value} {a.points > 0 ? `+${a.points}` : '· 0'}</i>; })}</span></div>)}
    </div>)}</div>
  </Modal>;
}

function PlayerProfile({ player, achievements, onClose }) {
  const unlock = achievements[String(player.key).toLocaleLowerCase()] || {};
  const av = { name: player.name, color: player.color };
  return <Modal title="Player profile" wide onClose={onClose}>
    <div className="profile-head">
      <Avatar player={av}/>
      <div><strong>{player.name}</strong><small>{player.wins} win{player.wins === 1 ? '' : 's'} · {player.games} game{player.games === 1 ? '' : 's'} · {player.winRate}% win rate</small></div>
      <b className="score">{player.points}</b>
    </div>
    <div className="profile-numbers">
      <div><span>Best score</span><b>{player.bestScore}</b></div>
      <div><span>Best round</span><b>{player.bestRound}</b></div>
      <div><span>Avg / game</span><b>{player.avgScore}</b></div>
      <div><span>Avg round</span><b>{player.avgRound}</b></div>
      <div><span>Current streak</span><b>{player.streak}</b></div>
      <div><span>Best streak</span><b>{player.bestStreak}</b></div>
      <div><span>Perfect rounds</span><b>{player.perfectRounds}{player.totalRounds ? <> <em>{player.perfectRate}%</em></> : ''}</b></div>
      <div><span>Fastest valid</span><b>{player.fastest !== null ? `${player.fastest}s` : '—'}</b></div>
      <div><span>Unique answers</span><b>{player.uniqueCount}</b></div>
      <div><span>Challenges</span><b>{player.challenges.tried ? `${player.challenges.won}/${player.challenges.tried}` : '—'}</b></div>
      <div><span>Hard-letter wins</span><b>{player.hardLetterWins}</b></div>
      <div><span>Comebacks</span><b>{player.comebacks}</b></div>
      <div><span>Best letter</span><b>{player.bestLetter || '—'}</b></div>
    </div>
    <div className="profile-block">
      <h4>Category accuracy</h4>
      <div className="cat-bars">{Object.entries(player.categories).map(([catKey, cat]) => { const rate = cat.answered ? Math.round((cat.scored / cat.answered) * 100) : 0; const def = CATEGORY_DEFS[catKey]; return <div className="cat-bar-row" key={catKey}><span>{def?.label || catKey}</span><div className="cat-bar"><i style={{ width: `${rate}%` }}/></div><b>{cat.scored}/{cat.answered}</b></div>; })}</div>
    </div>
    <div className="profile-block">
      <h4>Letter mastery</h4>
      <div className="letter-grid">{LETTERS.map((letter) => { const lt = player.letters[letter]; const rate = lt ? lt.scored / lt.answered : 0; const cls = !lt ? 'empty' : rate >= 0.7 ? 'good' : rate >= 0.4 ? 'mid' : 'low'; return <div className={`letter-cell ${cls}`} key={letter} title={lt ? `Letter ${letter}: ${lt.scored}/${lt.answered}` : `Letter ${letter}: never played`}><span>{letter}</span><i/></div>; })}</div>
    </div>
    <div className="profile-block">
      <h4>Achievements</h4>
      <div className="ach-list">{ACHIEVEMENTS.map((a) => { const Icon = ACH_ICONS[a.icon] || Trophy; const has = Boolean(unlock[a.key]); return <div className={`ach-row ${has ? 'unlocked' : ''}`} key={a.key}><span className="ach-row-icon"><Icon size={15}/></span><span className="ach-row-txt"><b>{a.name}</b><small>{a.detail}</small></span><span className="ach-row-date">{has ? new Date(unlock[a.key]).toLocaleDateString() : 'Locked'}</span></div>; })}</div>
    </div>
  </Modal>;
}

function Stats({ history, achievements, onBack, onPlay, onClear }) {
  const career = useMemo(() => computeCareerStats(history), [history]);
  const [openId, setOpenId] = useState(null);
  const [openPlayer, setOpenPlayer] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const open = useMemo(() => history.find((g) => g.id === openId) || null, [history, openId]);
  const top = career[0];
  const status = career.length ? { points: career.reduce((s, p) => s + p.points, 0), wins: career.reduce((s, p) => s + p.wins, 0) } : null;
  const holders = useMemo(() => Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, career.filter((p) => (achievements[String(p.key).toLocaleLowerCase()] || {})[a.key])])), [career, achievements]);
  const unlockedTotal = career.reduce((s, p) => s + Object.keys(achievements[String(p.key).toLocaleLowerCase()] || {}).length, 0);
  return <Shell><section className="stats page">
    <button className="back" onClick={onBack}><ChevronLeft size={17}/> Home</button>
    <div className="section-heading"><span className="eyebrow"><BarChart3 size={15}/> Performance dashboard</span><h2>The scoreboard.</h2><p>Every match played on this device, remembered.</p></div>
    {career.length === 0 ? <div className="empty-state glass"><Sparkles size={26}/><h3>No games yet</h3><p>Finish your first match and your stats will start appearing here.</p><Button onClick={onPlay}>START GAME <ArrowRight size={18}/></Button></div> : <>
      <div className="stat-chips">
        <div className="stat-chip glass"><span>Games</span><b>{history.length}</b></div>
        <div className="stat-chip glass"><span>Players</span><b>{career.length}</b></div>
        <div className="stat-chip glass"><span>Top player</span><b className="chip-name">{top ? top.name : '—'}</b></div>
        <div className="stat-chip glass"><span>Achievements</span><b>{unlockedTotal}</b></div>
      </div>
      <div className="ach-board" aria-label="Achievements">{ACHIEVEMENTS.map((a) => {
        const Icon = ACH_ICONS[a.icon] || Trophy;
        const h = holders[a.key];
        const unlocked = h.length > 0;
        return <button key={a.key} className={`ach-card ${unlocked ? 'unlocked' : ''}`} disabled={!unlocked} onClick={() => setOpenPlayer(h[0])} aria-label={`${a.name}${unlocked ? ` unlocked by ${h[0].name}` : ' locked'}`}>
          <Icon size={18}/>
          <b>{a.name}</b>
          <span>{a.detail}</span>
          <em>{unlocked ? `Unlocked by ${h.length}` : 'Locked'}</em>
        </button>;
      })}</div>
      <div className="player-stats-grid">{career.map((p, i) => (
        <article className="player-stat-card glass" key={p.key}>
          <div className="stat-head"><Avatar player={p}/><div><strong>{p.name}</strong><small>{p.wins} win{p.wins === 1 ? '' : 's'} · {p.winRate}% win rate</small></div>{i < 3 && <span className="medal" style={{ color: medalTone[i] }} title={i === 0 ? 'Leader' : i === 1 ? 'Runner-up' : 'Bronze'}><Medal size={18}/></span>}<Button variant="quiet" className="profile-btn" onClick={() => setOpenPlayer(p)}><User size={13}/> Profile</Button><b className="score">{p.points}</b></div>
          <div className="stat-numbers">
            <div><span>Games</span><b>{p.games}</b></div>
            <div><span>Best round</span><b>{p.bestRound}</b></div>
            <div><span>Avg / game</span><b>{p.avgScore}</b></div>
            <div><span>Perfect</span><b>{p.perfectRate}%</b></div>
            <div><span>Best letter</span><b>{p.bestLetter || '—'}</b></div>
            <div><span>Fastest valid</span><b>{p.fastest !== null ? `${p.fastest}s` : '—'}</b></div>
            <div><span>Unique answers</span><b>{p.uniqueCount}</b></div>
            <div><span>Challenges</span><b>{p.challenges.tried ? `${p.challenges.won}/${p.challenges.tried}` : '—'}</b></div>
            <div><span>Streak</span><b>{p.bestStreak > p.streak ? `${p.streak} now · ${p.bestStreak} best` : p.streak}</b></div>
            <div><span>Hard letters</span><b>{p.hardLetterWins}</b></div>
            <div><span>Comebacks</span><b>{p.comebacks}</b></div>
          </div>
          <div className="cat-bars">{Object.entries(p.categories).map(([catKey, cat]) => { const rate = cat.answered ? Math.round((cat.scored / cat.answered) * 100) : 0; const def = CATEGORY_DEFS[catKey]; return <div className="cat-bar-row" key={catKey}><span>{def?.label || catKey}</span><div className="cat-bar"><i style={{ width: `${rate}%` }}/></div><b>{cat.scored}/{cat.answered}</b></div>; })}</div>
          {p.form.length > 0 && <div className="form-block"><label>Recent form</label><div className="form-row">{p.form.map((f) => <span key={`${f.id}-${f.score}`} className={`form-cell ${f.win ? 'win' : f.tie ? 'tie' : 'loss'}`} style={{ height: `${Math.max(18, Math.min(100, 18 + (f.score / 120) * 82))}%` }} title={`${new Date(f.date).toLocaleDateString()} · ${f.score} pts${f.win ? ' · win' : f.tie ? ' · tie' : ''}`}/>)}</div><em>last {p.form.length} games — tall = more points</em></div>}
        </article>
      ))}</div>
      <div className="history-card glass">
        <div className="history-head"><div><label>Recent games</label><small>Tap a game for the full round-by-round breakdown.</small></div><button className="clear-btn" onClick={() => setConfirmClear(true)}><Trash2 size={15}/> Clear history</button></div>
        <div className="recent-list">{history.slice(0, 8).map((g) => { const sorted = [...g.players].sort((a, b) => b.score - a.score); const win = g.winnerId ? g.players.find((p) => p.id === g.winnerId) : null; const gMode = MODES.find((m) => m.key === g.mode || m.key === g.settings?.mode) || MODES[0]; return <button className="recent-row" key={g.id} onClick={() => setOpenId(g.id)}><div className="recent-date">{new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><span className="recent-mode">{gMode.name}</span><div className="recent-players">{sorted.map((p) => <span key={p.id}><i style={{ background: p.color }}/>{p.name} · {p.score}</span>)}</div>{win ? <div className="recent-winner"><Crown size={13}/> {win.name}</div> : <div className="recent-winner tie">Tie</div>}<ChevronRight size={16}/></button>; })}</div>
      </div>
      {status && status.points > 0 && <p className="ready-note">{career.length} player{career.length === 1 ? '' : 's'} · {status.points} total points · {status.wins} wins</p>}
    </>}
    {open && <GameDetail entry={open} onClose={() => setOpenId(null)}/>}
    {openPlayer && <PlayerProfile player={openPlayer} achievements={achievements} onClose={() => setOpenPlayer(null)}/>}
    {confirmClear && <Modal title="Clear history?" onClose={() => setConfirmClear(false)}>
      <p>All {history.length} recorded game{history.length === 1 ? '' : 's'} will be permanently deleted.</p>
      <div><Button variant="quiet" onClick={() => setConfirmClear(false)}>Keep them</Button><Button onClick={() => { onClear(); setConfirmClear(false); }}>Clear history</Button></div>
    </Modal>}
  </section></Shell>;
}

export default function App() {
  const [settings, setSettings] = useState(readSaved);
  const [history, setHistory] = useState(() => { const stored = load(KEYS.HISTORY, []); return Array.isArray(stored) ? stored : []; });
  const [achievements, setAchievements] = useState(() => { const stored = load(KEYS.ACHIEVEMENTS, {}); return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}; });
  const [stage, setStage] = useState('home');
  const [game, setGame] = useState(null);
  const [muted, setMuted] = useState(() => Boolean(load(KEYS.SOUND, false)));
  const submittedRef = useRef(null);

  useEffect(() => { setSoundMuted(muted); }, [muted]);
  useStored(KEYS.SOUND, muted);
  useStored(KEYS.SETTINGS, settings);
  useStored(KEYS.HISTORY, history);
  useStored(KEYS.ACHIEVEMENTS, achievements);

  const toReveal = useCallback(() => setStage('reveal'), []);
  const enterGame = useCallback(() => setStage('game'), []);

  const start = () => {
    submittedRef.current = null;
    const cats = getCategories(settings.theme, settings.categories);
    const next = { settings, mode: settings.mode, cats, round: 1, letter: randomLetter([]), used: [], roundLog: [], overrides: {}, verdicts: {}, ended: false, survivorId: null, alive: settings.players.map((p) => p.id), startedAt: Date.now(), players: settings.players.map((p) => ({ ...p, score: 0, lastScore: 0, streak: 0 })) };
    setGame(next);
    setStage('intro');
  };
  const submit = (answers, timings = {}) => {
    if (stage !== 'game' || !game || submittedRef.current === game.round) return;
    submittedRef.current = game.round;
    const active = game.players.filter((p) => !game.alive || game.alive.includes(p.id));
    const streaks = Object.fromEntries(active.map((p) => [p.id, p.streak || 0]));
    const scored = scoreRound({ players: active, answers, letter: game.letter, duplicatesAllowed: game.settings.duplicatesAllowed, categories: game.cats, overrides: game.overrides, profile: game.settings.profile, streaks, timings, timer: game.settings.timer });
    const winnerId = roundWinnerId(scored);
    const byId = Object.fromEntries(scored.map((r) => [r.playerId, r]));
    setGame((g) => {
      const players = g.players.map((p) => {
        const r = byId[p.id];
        if (!r) return p;
        const streak = r.streak ? r.streak : (winnerId === null ? (p.streak || 0) : 0);
        return { ...p, result: r, lastScore: r.total, score: p.score + r.total, streak };
      });
      const dead = g.mode === 'sudden-death' ? scored.filter((r) => r.total === 0).map((r) => r.playerId) : [];
      const nextAlive = (g.alive || g.players.map((p) => p.id)).filter((id) => !dead.includes(id));
      const end = suddenDeathEnd(nextAlive);
      const roundLog = [...(g.roundLog || []), { round: g.round, letter: g.letter, roster: active.map((p) => p.id), answers, results: scored, overrides: g.overrides, streaksAt: streaks, timings, winnerId, dead }];
      return { ...g, players, alive: nextAlive, ended: g.mode === 'sudden-death' ? end.finished : g.ended, survivorId: g.mode === 'sudden-death' ? end.survivorId : null, roundLog };
    });
    setStage('results');
  };
  const adjudicate = (verdict) => setGame((g) => {
    const last = g.roundLog?.[g.roundLog.length - 1];
    if (!last || !verdict) return g;
    const keyId = `${verdict.playerId}:${verdict.catKey}`;
    if (g.verdicts?.[keyId]) return g;
    const overrides = verdict.accepted
      ? { ...(g.overrides || {}), [verdict.catKey]: { ...((g.overrides || {})[verdict.catKey] || {}), [verdict.normalized]: true } }
      : g.overrides || {};
    const roster = last.roster || g.players.map((p) => p.id);
    const scoredPlayers = g.players.filter((p) => roster.includes(p.id));
    const scored = scoreRound({ players: scoredPlayers, answers: last.answers, letter: last.letter, duplicatesAllowed: g.settings.duplicatesAllowed, categories: g.cats, overrides, profile: g.settings.profile, streaks: last.streaksAt || {}, timings: last.timings || {}, timer: g.settings.timer });
    const winnerId = roundWinnerId(scored);
    const byId = Object.fromEntries(scored.map((r) => [r.playerId, r]));
    const players = g.players.map((p) => {
      const r = byId[p.id];
      if (!r) return p;
      const streak = r.streak ? r.streak : (winnerId === null ? (p.streak || 0) : 0);
      return { ...p, result: r, lastScore: r.total, score: p.score - p.lastScore + r.total, streak };
    });
    const roundLog = [...g.roundLog.slice(0, -1), { ...last, results: scored, overrides, winnerId }];
    return { ...g, players, overrides, verdicts: { ...g.verdicts, [keyId]: { accepted: verdict.accepted, validCount: verdict.validCount, invalidCount: verdict.invalidCount } }, roundLog };
  });
  const next = () => {
    if (game.ended || game.round >= game.settings.rounds) { setStage('final'); return; }
    const previous = [...game.used, game.letter];
    setGame((g) => ({ ...g, round: g.round + 1, used: previous, letter: randomLetter(previous) }));
    setStage('intro');
  };
  const newGame = () => { setGame(null); setStage('setup'); };
  const goStats = () => setStage('stats');
  const hideSound = ['game', 'reveal', 'intro'].includes(stage);

  return <>
    {!hideSound && <button className="sound-toggle" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>}
    <AnimatePresence mode="wait">
      {stage === 'home' && <Landing key="home" begin={() => setStage('setup')} onStats={goStats} history={history}/>}
      {stage === 'setup' && <Setup key="setup" settings={settings} setSettings={setSettings} start={start} back={() => setStage('home')}/>}
      {stage === 'intro' && <Intro key={`intro-${game.round}`} game={game} introMs={game.mode === 'speed' ? 1500 : 2400} onBegin={toReveal}/>}
      {stage === 'reveal' && <Reveal key={`reveal-${game.round}`} letter={game.letter} fast={game.mode === 'speed'} finish={enterGame}/>}
      {stage === 'game' && <Game key={`game-${game.round}`} game={game} submit={submit} skip={submit}/>}
      {stage === 'results' && <Results key={`results-${game.round}`} game={game} next={next} onAdjudicate={adjudicate}/>}
      {stage === 'final' && <Final key={`final-${game.round}`} game={game} playAgain={start} newGame={newGame} onStats={goStats} history={history} setHistory={setHistory} achievements={achievements} setAchievements={setAchievements}/>}
      {stage === 'stats' && <Stats key="stats" history={history} achievements={achievements} onBack={() => setStage('home')} onPlay={() => setStage('setup')} onClear={() => setHistory([])}/>}
    </AnimatePresence>
  </>;
}