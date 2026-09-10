export const COUNTER_TTL = 10 * 1000;
export type CounterAnchor = { count: number; savedAt: number };
export function parseCounter(value: unknown): CounterAnchor | null {
  if (!value || typeof value !== 'object') return null;
  const { count, savedAt } = value as CounterAnchor;
  return Number.isSafeInteger(count) && count >= 0 && Number.isFinite(savedAt) && savedAt > 0 && savedAt <= Date.now()
    ? { count, savedAt } : null;
}
export function mergeCounter(current: CounterAnchor | null, incoming: CounterAnchor | null): CounterAnchor | null {
  if (!incoming) return current;
  if (!current) return incoming;
  // Neither a stale edge response nor a late response from another tab can rewind.
  return { count: Math.max(current.count, incoming.count), savedAt: Math.max(current.savedAt, incoming.savedAt) };
}
