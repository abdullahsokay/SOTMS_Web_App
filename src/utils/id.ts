/** Collision-resistant id with prefix, safe in non-secure contexts. */
export function genId(prefix: string): string {
  const rnd = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rnd.toUpperCase()}`;
}
