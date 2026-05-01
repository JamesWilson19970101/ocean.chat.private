/* eslint-disable */
import * as request from 'supertest';

/**
 * @file Gateway Throttling E2E Test Suite
 *
 * Focus: API Rate Limiting (Protection against Brute-force/DoS).
 * This suite verifies that the API Gateway correctly enforces request limits
 * using the ThrottlerModule and Redis storage.
 *
 * Rules:
 * - Black-Box: Requests the live Gateway URL.
 * - Real Infrastructure: Relies on real Redis for rate limit tracking.
 */
describe('Gateway Resilience: Rate Limiting', () => {
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';

  /**
   * Test Scenario: Flood protection.
   * Condition: Send more requests than the configured limit (10 req/sec).
   * Expectation: The gateway returns 429 Too Many Requests after the limit is exceeded.
   */
  it('should return 429 when the rate limit (10 req/s) is exceeded', async () => {
    // configured limit is 10 per 1 second.
    // Use a unique IP address via X-Forwarded-For to avoid blocking other tests running on localhost
    const uniqueIp = '192.168.1.100';
    const requests = Array.from({ length: 15 }).map(() =>
      request(GATEWAY_URL)
        .post('/auth/login')
        .set('X-Forwarded-For', uniqueIp)
        .send({ username: 'test', password: 'password', deviceId: 'test' }),
    );

    const responses = await Promise.all(requests);

    // Check if at least one request was throttled
    const throttledResponses = responses.filter((res) => res.status === 429);

    expect(throttledResponses.length).toBeGreaterThan(0);
    expect(throttledResponses[0].body.message).toMatch(/Too many requests/i);
  });
});
