/* eslint-disable */
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Auth Blacklist E2E Test Suite
 *
 * Focus: Token Revocation Real-time Enforcement.
 * This suite ensures that once a user logs out, their Access Token is immediately
 * blacklisted and cannot be reused, even if it hasn't mathematically expired yet.
 *
 * Rules:
 * - Event-Driven: Confirms NATS logout events propagate to the Gateway's local blacklist.
 * - Security: Closes the window for stolen token reuse after logout.
 */
describe('Gateway Security: Token Blacklist', () => {
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';

  /**
   * Scenario: Immediate revocation on logout.
   * 1. Register and Login to get a valid token.
   * 2. Verify the token works for /users/me.
   * 3. Call /auth/logout.
   * 4. Verify the SAME token now returns 401 Unauthorized.
   */
  it('should reject access using a token that has been logged out', async () => {
    const username = `user_${uuidv4().substring(0, 8)}`;
    const password = 'StrongPassword123!';

    // Step 1: Register
    const regisRes = await request(GATEWAY_URL)
      .post('/auth/register')
      .send({ username, password, confirmPassword: password });

    // Step 2: Login
    const loginRes = await request(GATEWAY_URL)
      .post('/auth/login')
      .send({ username, password, deviceId: 'test-device' });

    const accessToken = loginRes.body.accessToken;
    expect(accessToken).toBeDefined();

    // Step 3: Verify access works
    const profileResBefore = await request(GATEWAY_URL)
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(profileResBefore.status).toBe(200);

    // Step 4: Logout
    await request(GATEWAY_URL)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send();

    // Give NATS event a tiny moment to propagate to the local memory blacklist
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 5: Verify access is now rejected
    const profileResAfter = await request(GATEWAY_URL)
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profileResAfter.status).toBe(401);
    expect(profileResAfter.body.errorCode).toBe(10030);
  });
});
