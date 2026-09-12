import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, Clock3, Copy, Crown, LogOut, RotateCcw, Sparkles, Volume2, VolumeX, Users,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from './game/categories.js';
import { connect } from './net/socket.js';
import { load, remove, save } from './utils/storage.js';
import { setMuted, sounds } from './utils/sounds.js';
import Button from './components/Button.jsx';
import Shell from './components/Shell.jsx';
import Avatar from './components/Avatar.jsx';

const LOCAL_KEYS = {
  PLAYER_ID: 'npat:playerId',
  NAME: 'npat:name',
  CODE: 'npat:code',
  HISTORY: 'npat:history',
  SOUND: 'npat:sound',
};

const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const fmtClock = (sec) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };

function useDeadline(deadline) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) { setLeft(0); return undefined; }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline]);
  return left;
}

function Home({ name, setName, status, error, history, onCreate, onJoin, muted, onToggleMute }) {
  const [code, setCode] = useState('');
  const ready = Boolean(name.trim());
  return <Shell><section className="home page">
    <button className="sound-toggle" aria-label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
    <div className="home-hero">
      <span className="eyebrow"><Sparkles size={15}/> Online multiplayer</span>
      <h1 className="home-title">NP<span>AT</span></h1>
      <p className="tagline">NAME · PLACE · ANIMAL · THING</p>
      <p className="intro">Race friends across the internet. Create a room, share the code, and own every round.</p>
    </div>
    <div className="home-panels">
      <div className="panel glass">
        <label htmlFor="your-name">Your name</label>
        <input id="your-name" className="text-input" value={name} maxLength={24} placeholder="e.g. Ravi" onChange={(e) => setName(e.target.value)}/>
        {status !== 'connected' && <p className="field-hint warn">Connecting to game server…</p>}
        <Button className="block" onClick={onCreate} disabled={!ready}><Users size={16}/> CREATE ROOM <ArrowRight size={16}/></Button>
      </div>
      <div className="join-sep"><span/></div>
      <div className="panel glass">
        <label htmlFor="join-code">Join a room</label>
        <input id="join-code" className="text-input code-input" value={code} maxLength={6} placeholder="AB7K2" onKeyDown={(e) => { if (e.key === 'Enter') onJoin(code); }} onChange={(e) => setCode(e.target.value.toUpperCase())}/>
        <Button className="block quiet" onClick={() => onJoin(code)} disabled={!ready || code.trim().length !== 5}><ArrowRight size={16}/> JOIN ROOM</Button>
      </div>
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <div className="scoring-legend">
      <span><b>+10</b> unique correct</span>
      <span><b>+5</b> duplicate correct</span>
      <span><b>0</b> blank / invalid</span>
      <span><b>40</b> max per round</span>
    </div>
    {history.length > 0 && <div className="recent">
      <h4>Your recent games</h4>
      <div className="recent-list">{history.map((g) => (
        <div className="recent-row" key={g.id}>
          <span className="recent-code">{g.code}</span>
          <span className="recent-winner">{g.winnerName ? `🏆 ${g.winnerName}` : 'Tie'}</span>
          <span className="recent-names">{g.players.map((p) => `${p.name} ${p.score}`).join(' · ')}</span>
          <em>{new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</em>
        </div>
      ))}</div>
    </div>}
  </section></Shell>;
}

function Lobby({ room, me, selfId, onSettings, onStart, onLeave }) {
  const host = room.players.find((p) => p.id === room.hostId);
  const connected = room.players.filter((p) => p.connected);
  const copy = async () => {
    try { await navigator.clipboard.writeText(room.code); sounds.pop(); } catch { /* noop */ }
  };
  return <Shell><section className="lobby page">
    <header className="lobby-head">
      <span className="eyebrow"><Users size={15}/> Lobby</span>
      <div className="room-code-box">
        <span>Room code</span>
        <b className="room-code">{room.code}</b>
        <button className="copy-btn" onClick={copy} aria-label="Copy room code"><Copy size={15}/> Copy</button>
      </div>
    </header>
    <div className="lobby-body glass">
      <div className="lobby-rows">
        <div className="lobby-meta"><span>{connected.length}/{room.players.length} connected</span><span>{room.totalRounds} rounds · {room.timerSeconds}s timer</span></div>
        <div className="players-list">
          {room.players.map((p) => (
            <div className={`player-row ${p.connected ? '' : 'offline'}`} key={p.id}>
              <Avatar player={p}/>
              <b>{p.name}</b>
              {p.id === room.hostId && <span className="host-chip"><Crown size={13}/> Host</span>}
              {p.connected ? <span className="dot on"/> : <span className="dot"/>}
              {p.id === selfId && <em className="you-chip">you</em>}
            </div>
          ))}
        </div>
        <p className="waiting-note">{room.players.length < 2 ? 'Share the code — waiting for players…' : `Ready to play with ${room.players.length} in the room.`}</p>
        {!me?.isHost && <p className="waiting-note warn">Waiting for {host?.name} to start…</p>}
      </div>
      {me?.isHost && <div className="host-controls">
        <div className="control-row">
          <label>Rounds</label>
          <div className="choice-row">{ROUND_OPTIONS.map((n) => <button className={room.totalRounds === n ? 'selected' : ''} key={n} onClick={() => onSettings({ totalRounds: n })}>{n}</button>)}</div>
        </div>
        <div className="control-row">
          <label>Timer</label>
          <div className="choice-row">{TIMER_OPTIONS.map((n) => <button className={room.timerSeconds === n ? 'selected' : ''} key={n} onClick={() => onSettings({ timerSeconds: n })}>{n}s</button>)}</div>
        </div>
        <Button className="block start" onClick={onStart} disabled={room.players.length < 2}>START GAME <ArrowRight size={16}/></Button>
      </div>}
    </div>
    <button className="link-btn" onClick={onLeave}><LogOut size={14}/> Leave room</button>
  </section></Shell>;
}

const ROUND_OPTIONS = [1, 3, 5, 10];
const TIMER_OPTIONS = [30, 60, 90];

function GameScreen({ room, selfId, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [sent, setSent] = useState(false);
  const left = useDeadline(room.deadline);
  const letter = room.letter;
  const lc = String(letter || '').toLowerCase();
  const submittedCount = Object.keys(room.submitted || {}).length;
  const numPlayers = room.players.filter((p) => p.connected).length;

  useEffect(() => { sounds.roundStart(); }, []);
  useEffect(() => {
    if (room.submitted?.[selfId]) setSent(true);
    if (room.status !== 'playing') setSent(false);
  }, [room.status, room.submitted, selfId]);
  useEffect(() => {
    if (left > 0 && left <= 5) sounds.tick();
  }, [left]);

  const submit = () => {
    if (sent || room.submitted?.[selfId]) return;
    sounds.submit();
    setSent(true);
    onSubmit({ ...Object.fromEntries(CATEGORY_KEYS.map((k) => [k, ''])), ...answers });
  };

  return <Shell><section className="game page">
    <header className="game-head">
      <span className="eyebrow">Round {room.roundNumber} / {room.totalRounds} · Room {room.code}</span>
      <div className="game-top">
        <div className="letter-card"><span>LETTER</span><b>{letter}</b></div>
        <div className={`timer-pill ${left <= 15 ? 'warn' : ''} ${left <= 5 ? 'critical' : ''}`}><Clock3 size={15}/><b>{fmtClock(left)}</b></div>
      </div>
    </header>
    <div className="answer-grid">
      {CATEGORIES.map((cat) => {
        const value = answers[cat.key] || '';
        const first = value.trim()[0]?.toLowerCase();
        const good = Boolean(value) && first === lc;
        const bad = Boolean(value) && first !== lc;
        return <label className={`answer-field ${good ? 'good' : bad ? 'bad' : ''} ${sent ? 'locked' : ''}`} key={cat.key}>
          <span className="answer-cat"><b>{cat.label}</b><em>{cat.key === 'name' ? 'A person' : cat.key === 'place' ? 'A place' : cat.key === 'animal' ? 'A creature' : 'A thing'}</em></span>
          <input value={value} disabled={sent || Boolean(room.submitted?.[selfId])} maxLength={60} placeholder={`${letter}…`} onChange={(e) => setAnswers((a) => ({ ...a, [cat.key]: e.target.value }))}/>
        </label>;
      })}
    </div>
    <footer className="game-foot">
      {sent || room.submitted?.[selfId]
        ? <div className="waiting-chip"><Check size={15}/> Submitted — waiting for {submittedCount}/{numPlayers} to lock in…</div>
        : <Button className="block start" onClick={submit}>SUBMIT ANSWERS <ArrowRight size={16}/></Button>}
    </footer>
  </section></Shell>;
}

function ResultMatrix({ room, selfId }) {
  const results = room.roundResults || [];
  const shown = room.players.filter((p) => results.some((r) => r.playerId === p.id));
  const byId = Object.fromEntries(results.map((r) => [r.playerId, r]));
  return <div className="result-matrix" role="table" aria-label="Round results">
    <div className="matrix-row head" role="row">
      <span className="matrix-cat" role="columnheader">Category</span>
      {shown.map((p) => <span className="matrix-player" role="columnheader" key={p.id}>{p.name}{p.id === selfId ? ' (you)' : ''}</span>)}
    </div>
    {CATEGORIES.map((cat) => <div className="matrix-row" role="row" key={cat.key}>
      <span className="matrix-cat" role="rowheader">{cat.label}</span>
      {shown.map((p) => {
        const a = byId[p.id]?.answers?.[cat.key];
        if (!a) return <span className="matrix-cell empty" key={p.id}>—</span>;
        const cls = a.valid ? 'ok' : 'zero';
        const tag = a.valid ? (a.duplicate ? 'dup' : 'uniq') : a.code;
        return <span className={`matrix-cell ${cls}`} key={p.id} role="cell">
          <b>{a.value || '—'}</b>
          <em>{a.valid ? (a.duplicate ? `+5 duplicate` : `+10 unique`) : a.code === 'wrong-letter' ? 'wrong letter' : a.code === 'blank' ? 'blank' : 'invalid'}</em>
        </span>;
      })}
    </div>)}
    <div className="matrix-row total" role="row">
      <span className="matrix-cat">Total</span>
      {shown.map((p) => <span className="matrix-total" role="cell" key={p.id}><b>+{byId[p.id]?.total || 0}</b></span>)}
    </div>
  </div>;
}

function Results({ room, selfId, me, onNext }) {
  useEffect(() => { sounds.correct(); }, []);
  const nextRound = room.roundNumber + 1;
  return <Shell><section className="results page">
    <header className="section-heading centered">
      <span className="eyebrow"><Check size={15}/> Round {room.roundNumber} complete</span>
      <h2>How did everyone do?</h2>
      <p>Unique correct = 10 · Duplicate correct = 5 · Blank / invalid = 0</p>
    </header>
    <ResultMatrix room={room} selfId={selfId}/>
    <div className="standings glass">
      {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => <div className={`stand-row ${p.id === selfId ? 'you' : ''}`} key={p.id}><span className="stand-rank">{i + 1}</span><Avatar player={p} small/><b>{p.name}</b><strong>{p.score}</strong></div>)}
    </div>
    <footer className="results-foot">
      {me?.isHost
        ? <Button className="block start" onClick={onNext}>START ROUND {Math.min(nextRound, room.totalRounds)} <ArrowRight size={16}/></Button>
        : <p className="waiting-note">Waiting for the host to start the next round…</p>}
    </footer>
  </section></Shell>;
}

function Final({ room, selfId, me, onPlayAgain, onLeave }) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = room.winnerId ? room.players.find((p) => p.id === room.winnerId) : null;
  const medals = ['🥇', '🥈', '🥉'];
  useEffect(() => { if (winner) sounds.win(); else sounds.tie(); }, [winner]);
  return <Shell><section className="final page">
    <div className="confetti" aria-hidden="true">✦ ✧ ● ✦ · ✧ ●</div>
    <Crown size={40} className="crown"/>
    <span className="eyebrow">Game complete</span>
    <h2>{winner ? `${winner.name} wins!` : "It's a tie!"}</h2>
    <p className="winner-label">{room.roundNumber} rounds · {room.players.length} players · room {room.code}</p>
    <div className="leaderboard glass">
      {sorted.map((p, i) => (
        <div className={`lb-row ${p.id === selfId ? 'you' : ''} ${i === 0 ? 'first' : ''}`} key={p.id}>
          <span className="lb-medal">{medals[i] || i + 1}</span>
          <Avatar player={p} small/><b>{p.name}</b>{p.id === selfId && <em className="you-chip">you</em>}
          <strong>{p.score}</strong>
        </div>
      ))}
    </div>
    <div className="final-actions">
      {me?.isHost ? <Button className="block" onClick={onPlayAgain}><RotateCcw size={16}/> PLAY AGAIN</Button> : <p className="waiting-note">Waiting for the host to restart…</p>}
      <Button variant="quiet" className="block" onClick={onLeave}><LogOut size={15}/> Back to home</Button>
    </div>
  </section></Shell>;
}

export default function App() {
  const [playerId] = useState(() => load(LOCAL_KEYS.PLAYER_ID, null) || makeId());
  const [name, setName] = useState(() => load(LOCAL_KEYS.NAME, ''));
  const [muted, setMutedState] = useState(() => Boolean(load(LOCAL_KEYS.SOUND, false)));
  const [history, setHistory] = useState(() => { const h = load(LOCAL_KEYS.HISTORY, []); return Array.isArray(h) ? h : []; });
  const [status, setStatus] = useState('connecting');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const historyRef = useRef(history);
  const recordedRef = useRef(null);
  const remainInRoom = useRef(load(LOCAL_KEYS.CODE, null) || null);

  useEffect(() => { save(LOCAL_KEYS.PLAYER_ID, playerId); }, [playerId]);
  useEffect(() => { save(LOCAL_KEYS.NAME, name); }, [name]);
  useEffect(() => { setMuted(muted); save(LOCAL_KEYS.SOUND, muted); }, [muted]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    const socket = connect();
    socketRef.current = socket;
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));
    socket.on('room:state', (state) => { setRoom(state); setError(null); if (state?.code) save(LOCAL_KEYS.CODE, state.code); });
    return () => { socket.close(); socket.stop?.(); };
  }, []);

  const emit = useCallback((event, payload = {}) => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) { resolve({ ok: false, error: { message: 'Not connected to the game server yet.' } }); return; }
    socket.emit(event, payload, (res) => {
      if (res && typeof res === 'object' && res.ok) resolve(res);
      else resolve({ ok: false, error: res?.error || { message: 'Server did not respond.' } });
    });
  }), []);

  const toastError = useCallback((res) => {
    if (!res.ok && res.error) setError(res.error.message);
  }, []);
  const applyState = useCallback((res) => { if (res.ok && res.state) { setRoom(res.state); setError(null); remainInRoom.current = res.state.code; } }, []);

  const me = useMemo(() => (room ? room.players.find((p) => p.id === playerId) || null : null), [room, playerId]);

  const leaveRoom = useCallback(() => {
    if (socketRef.current && room?.code) socketRef.current.emit('room:leave', { code: room.code });
    remove(LOCAL_KEYS.CODE);
    remainInRoom.current = null;
    setRoom(null);
  }, [room]);

  useEffect(() => {
    if (status !== 'connected' || room || !remainInRoom.current) return;
    const code = remainInRoom.current;
    emit('room:join', { code, name, playerId }).then((res) => {
      if (res.ok) { applyState(res); return; }
      remove(LOCAL_KEYS.CODE);
      remainInRoom.current = null;
    });
  }, [status, room, name, playerId, emit, applyState]);

  useEffect(() => {
    if (room?.status === 'finished' && recordedRef.current !== room.code) {
      recordedRef.current = room.code;
      const winner = room.winnerId ? room.players.find((p) => p.id === room.winnerId) : null;
      const entry = {
        id: makeId(),
        date: new Date().toISOString(),
        code: room.code,
        rounds: room.totalRounds,
        winnerName: winner ? winner.name : null,
        players: room.players.map((p) => ({ name: p.name, score: p.score })),
      };
      const next = [entry, ...historyRef.current].slice(0, 20);
      setHistory(next);
      save(LOCAL_KEYS.HISTORY, next);
    }
  }, [room]);

  const onCreate = async () => {
    const res = await emit('room:create', { name, playerId });
    toastError(res); applyState(res);
  };
  const onJoin = async (code) => {
    const res = await emit('room:join', { code, name, playerId });
    toastError(res); applyState(res);
  };
  const onSettings = async (patch) => { toastError(await emit('room:settings', { code: room.code, ...patch })); };
  const onStart = async () => { toastError(await emit('room:start', { code: room.code })); };
  const onSubmit = async (answers) => { toastError(await emit('round:submit', { code: room.code, answers })); };
  const onNext = async () => { toastError(await emit('round:next', { code: room.code })); };
  const onPlayAgain = async () => { toastError(await emit('room:playAgain', { code: room.code })); };

  const reduce = useReducedMotion();
  const fade = (d = 0) => (reduce ? false : { opacity: 0, y: 14 });

  const screen = !room ? (
    <Home key="home" name={name} setName={setName} status={status} error={error} history={history} onCreate={onCreate} onJoin={onJoin} muted={muted} onToggleMute={() => setMutedState((m) => !m)}/>
  ) : room.status === 'lobby' ? (
    <Lobby key={`lobby-${room.code}`} room={room} me={me} selfId={playerId} onSettings={onSettings} onStart={onStart} onLeave={leaveRoom}/>
  ) : room.status === 'playing' ? (
    <GameScreen key={`game-${room.roundNumber}`} room={room} selfId={playerId} onSubmit={onSubmit}/>
  ) : room.status === 'results' ? (
    <Results key={`results-${room.roundNumber}`} room={room} selfId={playerId} me={me} onNext={onNext}/>
  ) : (
    <Final key={`final-${room.code}`} room={room} selfId={playerId} me={me} onPlayAgain={onPlayAgain} onLeave={leaveRoom}/>
  );

  return <AnimatePresence mode="wait">
    <motion.div key={screen.key} initial={fade()} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }}>
      {screen}
    </motion.div>
  </AnimatePresence>;
}