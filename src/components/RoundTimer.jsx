import { useEffect, useRef } from 'react';
import { useTimer } from '../utils/useTimer';
import { sounds } from '../utils/sounds';

const RADIUS = 29;
const CIRC = 2 * Math.PI * RADIUS;

function TimerRing({ time, total }) {
  const pct = total ? Math.min(time / total, 1) : 1;
  const color = time <= 5 ? 'var(--danger)' : time <= 15 ? 'var(--warning)' : 'var(--accent)';
  return <div className={`timer-ring ${time <= 5 ? 'critical' : time <= 15 ? 'warning' : ''}`} role="timer" aria-live="off" aria-label={`${time} seconds left`}>
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <circle className="timer-ring-track" cx="36" cy="36" r={RADIUS}/>
      <circle className="timer-ring-progress" cx="36" cy="36" r={RADIUS} style={{ stroke: color, strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - pct) }}/>
    </svg>
    <span className="timer-ring-time">{time}</span>
  </div>;
}

export default function RoundTimer({ total, active, onComplete, onTick }) {
  const left = useTimer(total, active, onComplete);
  const prev = useRef(left);
  useEffect(() => {
    if (left < prev.current && left > 0 && left <= 5) sounds.tick();
    prev.current = left;
    onTick(left);
  }, [left, onTick]);
  return <div className="timer-chip"><TimerRing time={left} total={total}/><span className="timer-chip-label">Seconds<br/>left</span></div>;
}