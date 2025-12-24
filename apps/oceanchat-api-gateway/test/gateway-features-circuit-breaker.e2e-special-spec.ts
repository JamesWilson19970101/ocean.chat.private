/**
 * apps/oceanchat-api-gateway/test/gateway-features-circuit-breaker.e2e-spec.ts
 *
 * E2E Tests for Gateway Infrastructure Features:
 * - Circuit Breaker
 *
 * NOTE: This test requires manually stopping the Auth Service to simulate a failure.
 */
import Redis from 'ioredis';
import { connect, connection } from 'mongoose';
import * as request from 'supertest';

describe('Gateway Features E2E Tests', () => {
  jest.setTimeout(10000);
  const GATEWAY_URL = 'http://localhost:1994';
  let redisClient: Redis;

  beforeAll(async () => {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB_TEST || '15', 10),
    });

    await connect('mongodb://localhost:27017/oceanchat_test');
  });

  afterAll(async () => {
    await redisClient.quit();
    await connection.close();
  });

  beforeEach(async () => {
    // clear state of throtter
    const keys = await redisClient.keys('throttler:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    await connection
      .collection('users')
      .deleteMany({ username: { $in: ['throttle-user', 'idempotency-user'] } });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker when downstream service is unavailable', async () => {
      // Note: This test requires manually stopping the Auth Service to simulate a failure.
      const loginDto = {
        username: 'cb-user',
        password: 'Password123!',
        deviceId: 'cb-device',
      };

      // Strategy: The Rate Limiter allows 10 req/s. The Circuit Breaker needs ~10 failures to open.
      // We send requests in batches to avoid 429s (which don't count as CB failures) while accumulating enough failures.

      const batch1: request.Test[] = [];
      for (let i = 0; i < 9; i++) {
        batch1.push(request(GATEWAY_URL).post('/auth/login').send(loginDto));
      }
      const p1 = Promise.all(batch1);

      // Wait for Rate Limiter window to reset (1s window)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const batch2: request.Test[] = [];
      for (let i = 0; i < 9; i++) {
        batch2.push(request(GATEWAY_URL).post('/auth/login').send(loginDto));
      }
      const p2 = Promise.all(batch2);

      console.log(
        'Sending 18 requests (in batches) to trigger circuit breaker failures...',
      );
      // Wait for all requests to complete (even if they fail)
      await Promise.all([p1, p2]);

      // Send request again, at this point the circuit breaker should be open (Open state)
      // Should return 503 Service Unavailable immediately, instead of waiting for timeout
      const res = await request(GATEWAY_URL).post('/auth/login').send(loginDto);

      if (res.status !== 503) {
        console.warn(
          '⚠️ Circuit Breaker did not open. Please ensure Oceanchat Auth Service is STOPPED to simulate failure.',
        );
      }

      expect(res.status).toBe(503);
    }, 30000);
  });
});
