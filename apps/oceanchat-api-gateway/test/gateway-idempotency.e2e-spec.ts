import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Gateway Idempotency E2E Test Suite
 *
 * Focus: Request Idempotency (Protection against duplicate writes).
 * This suite ensures that identical requests with the same idempotency key
 * are only processed once by the backend microservices.
 *
 * Rules:
 * - Real Redis: The Idempotency Interceptor stores results in Redis.
 * - Multi-Step verification: Check if the second response is identical to the first.
 */
describe('Gateway Resilience: Idempotency', () => {
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';

  /**
   * Test Scenario: Deduplication of registration requests.
   * Condition: Send two POST requests with the same Idempotency-Key.
   * Expectation: The second request returns the exact same result as the first,
   * without creating a second user in the database.
   */
  it('should return identical responses for requests with the same idempotency key', async () => {
    const idempotencyKey = uuidv4();
    const payload = {
      username: `user_${uuidv4().substring(0, 8)}`,
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    // First attempt
    const res1 = await request(GATEWAY_URL)
      .post('/auth/register')
      .set('idempotency-key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(200);
    const firstBody = res1.body;

    // Second attempt (identical key)
    const res2 = await request(GATEWAY_URL)
      .post('/auth/register')
      .set('idempotency-key', idempotencyKey)
      .send(payload);

    // Verify: Status and body should match the cached result
    expect(res2.status).toBe(res1.status);
    expect(res2.body).toEqual(firstBody);

    // Header check: Some systems add 'X-Cache: HIT' or similar,
    // but here we focus on behavioral identity.
  });
});
