/**
 * Fixed-window in-memory rate limiter. Good enough for a single-process deployment;
 * move to a shared store if the app ever runs on more than one instance (docs/12-security.md).
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly max: number, private readonly windowMs: number) {}

  /** Returns true when the action is allowed and records it. */
  take(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 50_000) this.sweep(now);
      return true;
    }
    entry.count++;
    return entry.count <= this.max;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private sweep(now: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
