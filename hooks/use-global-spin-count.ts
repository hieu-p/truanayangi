'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeCounter, parseCounter, COUNTER_TTL } from '../lib/global-counter';

const apiUrl = process.env.NEXT_PUBLIC_COUNTER_API_URL || '';
const sampleWeight = 8;
// Retire v2: its extrapolated display was not a server-confirmed total.
const storageKey = 'truanayangi-counter-confirmed-v3';

function sampled(oneIn: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] < Math.floor(0x1_0000_0000 / oneIn);
}

export function useGlobalSpinCount() {
  const [count, setCount] = useState<number | null>(null);
  const alive = useRef(true);
  const anchor = useRef<ReturnType<typeof parseCounter>>(null);
  const accept = useCallback((data: { count?: unknown }) => {
    if (!alive.current) return;
    const incoming = parseCounter({ count: data.count, savedAt: Date.now() });
    if (!incoming) return;
    let cached = null;
    try { cached = parseCounter(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch {}
    anchor.current = mergeCounter(mergeCounter(anchor.current, cached), incoming);
    try { localStorage.setItem(storageKey, JSON.stringify(anchor.current)); } catch {}
    setCount(anchor.current!.count);
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!apiUrl) return () => { alive.current = false; };
    try { anchor.current = parseCounter(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch {}
    setCount(anchor.current?.count ?? null);
    let pending = false;
    let lastAttempt = 0;
    const refresh = async () => {
      const now = Date.now();
      if (document.hidden || pending || now - lastAttempt < COUNTER_TTL ||
          (anchor.current && now - anchor.current.savedAt < COUNTER_TTL)) return;
      pending = true;
      lastAttempt = now;
      try {
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
        if (response.ok) accept(await response.json());
      } catch { /* A counter outage must not interrupt opening a case. */ }
      finally { pending = false; }
    };
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      try {
        anchor.current = mergeCounter(anchor.current, parseCounter(JSON.parse(event.newValue || 'null')));
        if (anchor.current) setCount(anchor.current.count);
      } catch {}
    };
    void refresh();
    // Poll only while visible; POST and cross-tab snapshots share the same TTL.
    const interval = window.setInterval(refresh, COUNTER_TTL);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', sync);
    return () => {
      alive.current = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', sync);
    };
  }, [accept]);

  const recordSpin = useCallback(async (id: string) => {
    if (!apiUrl || !sampled(sampleWeight)) return;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ id, weight: sampleWeight }), keepalive: true, signal: AbortSignal.timeout(4000),
      });
      if (response.ok) accept(await response.json());
    } catch { /* A counter outage must not interrupt opening a case. */ }
  }, [accept]);
  return { count, enabled: Boolean(apiUrl), recordSpin };
}
