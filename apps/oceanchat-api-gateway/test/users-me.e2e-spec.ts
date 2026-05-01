/* eslint-disable */
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Users Profile E2E Test Suite
 *
 * Focus: Microservice Data Aggregation.
 * This suite ensures that the Gateway correctly communicates with the User microservice
 * via NATS to assemble and return the full user profile.
 *
 * Rules:
 * - Distributed: Verifies Gateway -> User Service RPC chain.
 * - Precision: Checks if sensitive internal fields are stripped from the response.
 */
describe('Gateway API: GET /users/me', () => {
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';

  /**
   * Scenario: Successful profile retrieval.
   * 1. Register a user.
   * 2. Login to get a token.
   * 3. Request /users/me.
   * 4. Verify data matches and internal fields (like providers) are absent.
   */
  it('should return the correct user profile and hide sensitive data', async () => {
    const username = `user_${uuidv4().substring(0, 8)}`;
    const password = 'StrongPassword123!';

    // 1. Create user
    await request(GATEWAY_URL)
      .post('/auth/register')
      .send({ username, password, confirmPassword: password });

    // 2. Login
    const loginRes = await request(GATEWAY_URL)
      .post('/auth/login')
      .send({ username, password, deviceId: 'test-device' });

    const accessToken = loginRes.body.accessToken;

    // 3. Get profile
    const res = await request(GATEWAY_URL)
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(username);
    expect(res.body._id).toBeDefined();

    // Privacy Check: Ensure sensitive microservice data is NOT leaked to the public API
    expect(res.body.providers).toBeUndefined();
    expect(res.body.password).toBeUndefined();
    expect(res.body.hash).toBeUndefined();
  });
});
