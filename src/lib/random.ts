export function uuid(): string {
  return crypto.randomUUID();
}

/** Stable 32-bit hash, used for per-card tilt and tape pattern. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic value in [-1, 1) from a string and a salt. */
export function jitter(s: string, salt = 0): number {
  return ((hash(s + ':' + salt) % 2000) / 1000) - 1;
}
