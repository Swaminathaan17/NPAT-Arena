import { useEffect, useRef, useState } from 'react';
export function useTimer(seconds, active, onComplete) {
  const [left, setLeft] = useState(seconds);
  const completeRef = useRef(onComplete);
  const doneRef = useRef(false);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => { setLeft(seconds); doneRef.current = false; }, [seconds]);
  useEffect(() => {
    if (!active || !seconds) return undefined;
    const id = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [active, seconds]);
  useEffect(() => {
    if (active && seconds && left <= 0 && !doneRef.current) {
      doneRef.current = true;
      completeRef.current?.();
    }
  }, [active, seconds, left]);
  return left;
}
