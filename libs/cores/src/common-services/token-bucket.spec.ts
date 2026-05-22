import { TokenBucket } from './token-bucket';

describe('TokenBucket', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start with full capacity', () => {
    const bucket = new TokenBucket(10, 1);
    expect(bucket.getAvailableTokens()).toBe(10);
  });

  it('should consume tokens', () => {
    const bucket = new TokenBucket(10, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.getAvailableTokens()).toBe(9);
  });

  it('should fail when tokens are exhausted', () => {
    const bucket = new TokenBucket(1, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it('should refill tokens over time', () => {
    const bucket = new TokenBucket(10, 1);
    bucket.consume(); // 9 left
    bucket.consume(); // 8 left
    expect(bucket.getAvailableTokens()).toBe(8);

    jest.advanceTimersByTime(2000); // 2 seconds * 1 token/sec = 2 tokens refilled
    expect(bucket.getAvailableTokens()).toBe(10);
  });

  it('should not exceed capacity during refill', () => {
    const bucket = new TokenBucket(10, 1);
    jest.advanceTimersByTime(5000);
    expect(bucket.getAvailableTokens()).toBe(10);
  });
});
