/**
 * A lightweight Token Bucket implementation for rate limiting.
 * Used at the gateway level to protect against malicious bursts.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  /**
   * @param capacity Maximum number of tokens the bucket can hold.
   * @param refillRate Number of tokens added per second.
   */
  constructor(
    private readonly capacity: number,
    private readonly refillRate: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Attempts to consume a token.
   * @returns true if a token was consumed, false otherwise.
   */
  public consume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const amount = elapsed * this.refillRate;

    if (amount > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + amount);
      this.lastRefill = now;
    }
  }

  /**
   * Returns current token count (mostly for testing).
   */
  public getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
