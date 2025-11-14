/**
 * Client-side rate limiter
 */

interface RateLimitState {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private defaultLimit: number;
  private defaultWindow: number;

  constructor(defaultLimit: number = 10, defaultWindow: number = 60000) {
    this.defaultLimit = defaultLimit;
    this.defaultWindow = defaultWindow;
  }

  check(key: string, limit?: number, windowMs?: number): boolean {
    const maxRequests = limit ?? this.defaultLimit;
    const window = windowMs ?? this.defaultWindow;
    const now = Date.now();

    const state = this.limits.get(key);

    if (!state || now > state.resetAt) {
      // Create new window
      this.limits.set(key, {
        count: 1,
        resetAt: now + window,
      });
      return true;
    }

    if (state.count >= maxRequests) {
      return false;
    }

    state.count++;
    return true;
  }

  getRemaining(key: string, limit?: number): number {
    const maxRequests = limit ?? this.defaultLimit;
    const state = this.limits.get(key);

    if (!state) {
      return maxRequests;
    }

    return Math.max(0, maxRequests - state.count);
  }

  getResetTime(key: string): number | null {
    const state = this.limits.get(key);
    return state ? state.resetAt : null;
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  clear(): void {
    this.limits.clear();
  }
}

export const rateLimiter = new RateLimiter();
