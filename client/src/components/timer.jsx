import { useEffect, useState } from 'react';
import { fmtTime } from '../api.js';

// Computes remaining time locally from the authoritative start/end timestamps.
export function useRemaining(event) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!event?.endTime) return null;
  if (event.status === 'PAUSED') return { paused: true, ...event, now };
  if (event.status === 'ENDED') return { ended: true, now, remaining: 0, ...event };
  const remaining = Math.max(0, Math.floor((new Date(event.endTime).getTime() - now) / 1000));
  return { ...event, now, remaining };
}

export function Timer({ event, className = '' }) {
  const t = useRemaining(event);
  if (!t) return <span className={className}>--:--</span>;
  if (t.paused) return <span className={className}>PAUSED</span>;
  if (t.ended || t.remaining <= 0) return <span className={className}>00:00</span>;
  return (
    <span className={`font-mono tabular-nums ${t.remaining < 300 ? 'text-red-600 dark:text-red-400' : ''} ${className}`}>
      {fmtTime(t.remaining)}
    </span>
  );
}