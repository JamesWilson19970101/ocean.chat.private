/**
 * apps/oceanchat-api-gateway/test/gateway-features.e2e-spec.ts
 *
 * E2E Tests for Gateway Infrastructure Features:
 * - Rate Limiting (Throttler)
 * - Idempotency
 * - Circuit Breaker
 */
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { connect, connection, Types } from 'mongoose';
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

  describe('Rate Limiting (Throtter)', () => {
    it('should limit requests to 10 per second', async () => {
      const password = 'Password123!';
      const hashedPassword = await argon2.hash(password);
      await connection.collection('users').insertOne({
        _id: new Types.ObjectId(),
        username: 'throttle-user',
        providers: [
          {
            provider: 'local',
            providerId: 'throttle-user',
            passwordHash: hashedPassword,
          },
        ],
        roles: ['user'],
        active: true,
      });

      const loginDto = {
        username: 'throttle-user',
        password: password,
        deviceId: 'test-device-id',
      };

      const requests: request.Test[] = [];

      for (let i = 0; i < 12; i++) {
        requests.push(request(GATEWAY_URL).post('/auth/login').send(loginDto));
      }

      const responses = await Promise.all(requests);

      const successCount = responses.filter((res) => res.status === 200).length;
      const tooManyRequestsCount = responses.filter(
        (res) => res.status === 429,
      ).length;

      console.log(
        `Rate Limit Test: Success=${successCount}, Throttled=${tooManyRequestsCount}`,
      );
      expect(successCount).toBeLessThanOrEqual(10);
      expect(tooManyRequestsCount).toBeGreaterThanOrEqual(1);
    });
  });
  describe('Circuit Breaker', () => {
    it('should open circuit breaker when downstream service is unavailable', async () => {
      // Note: This test requires manually stopping the Auth Service to simulate a failure.
      const loginDto = {
        username: 'cb-user',
        password: 'Password123!',
        deviceId: 'cb-device',
      };
      const requests: request.Test[] = [];
      // Send 15 requests concurrently to ensure exceeding volumeThreshold (10)
      // If Auth Service is stopped, these requests will timeout or error, increasing the error rate
      for (let i = 0; i < 15; i++) {
        requests.push(request(GATEWAY_URL).post('/auth/login').send(loginDto));
      }

      console.log('Sending 15 requests to trigger circuit breaker failures...');
      // Wait for all requests to complete (even if they fail)
      await Promise.all(requests);

      // Send request again, at this point the circuit breaker should be open (Open state)
      // Should return 503 Service Unavailable immediately, instead of waiting for timeout
      const res = await request(GATEWAY_URL).post('/auth/login').send(loginDto);

      if (res.status !== 503) {
        console.warn(
          '⚠️ Circuit Breaker did not open. Please ensure Oceanchat Auth Service is STOPPED to simulate failure.',
        );
      }

      expect(res.status).toBe(503);
    });
  });
});
