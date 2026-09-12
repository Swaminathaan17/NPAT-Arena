let ctx = null;
let _muted = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.3, delay = 0) {
  if (_muted) return;
  try {
    const c = getCtx();
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch { /* AudioContext unavailable */ }
}

export const sounds = {
  type: () => tone(520, 0.04, 'sine', 0.07),
  tick: () => tone(880, 0.06, 'sine', 0.12),
  submit: () => { tone(523, 0.12, 'sine', 0.18); tone(659, 0.12, 'sine', 0.18, 0.08); },
  correct: () => { tone(523, 0.1, 'sine', 0.2); tone(659, 0.1, 'sine', 0.2, 0.08); tone(784, 0.18, 'sine', 0.2, 0.16); },
  wrong: () => tone(180, 0.25, 'sawtooth', 0.08),
  reveal: () => { for (let i = 0; i < 14; i++) tone(350 + Math.random() * 500, 0.04, 'sine', 0.08, i * 0.04); },
  win: () => { tone(523, 0.15, 'sine', 0.22); tone(659, 0.15, 'sine', 0.22, 0.1); tone(784, 0.15, 'sine', 0.22, 0.2); tone(1047, 0.3, 'sine', 0.22, 0.3); },
  challenge: () => { tone(330, 0.1, 'triangle', 0.18); tone(660, 0.15, 'triangle', 0.18, 0.12); },
  pop: () => tone(660, 0.05, 'sine', 0.1),
  roundStart: () => { tone(392, 0.08, 'sine', 0.15); tone(523, 0.1, 'sine', 0.17, 0.08); tone(659, 0.2, 'sine', 0.17, 0.16); },
  valid: () => { tone(587, 0.09, 'triangle', 0.15); tone(784, 0.14, 'triangle', 0.15, 0.07); },
  move: () => tone(987, 0.05, 'sine', 0.08),
  achievement: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.17, i * 0.09)); tone(1568, 0.3, 'sine', 0.13, 0.38); },
  tie: () => { tone(440, 0.14, 'sine', 0.16); tone(415, 0.22, 'sine', 0.16, 0.12); },
};

export function setMuted(v) { _muted = v; }
export function getMuted() { return _muted; }