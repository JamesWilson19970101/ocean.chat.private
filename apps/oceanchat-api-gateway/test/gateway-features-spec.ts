/**
 * apps/oceanchat-api-gateway/test/gateway-features.e2e-spec.ts
 * Taking /auth/login as an example, I tested various features.
 *
 * E2E Tests for Gateway Infrastructure Features:
 * - Rate Limiting (Throttler)
 * - Idempotency
 * - CORS
 * - Body Size Limit
 * - Security Headers (Helmet)
 * - Trust Proxy
 * - Validation Pipe
 */
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { connect, connection, Types } from 'mongoose';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

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
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
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
      expect(successCount).toBeGreaterThan(1);
      expect(successCount).toBeLessThanOrEqual(10);
      expect(tooManyRequestsCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Idempotency', () => {
    it('should return cached response for duplicate requests with same idempotency key', async () => {
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const password = 'Password123!';
      const hashedPassword = await argon2.hash(password);
      await connection.collection('users').insertOne({
        _id: new Types.ObjectId(),
        username: 'idempotency-user',
        providers: [
          {
            provider: 'local',
            providerId: 'idempotency-user',
            passwordHash: hashedPassword,
          },
        ],
        roles: ['user'],
        active: true,
      });
      const loginDto = {
        username: 'idempotency-user',
        password: password,
        deviceId: 'idempotency-device',
      };
      const idempotencyKey = uuidv4();

      // First Request
      const res1 = await request(GATEWAY_URL)
        .post('/auth/login')
        .set('idempotency-key', idempotencyKey)
        .send(loginDto);
      expect(res1.status).toBe(200);

      // Second Request (Should be cached)
      const res2 = await request(GATEWAY_URL)
        .post('/auth/login')
        .set('idempotency-key', idempotencyKey)
        .send(loginDto);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    });
  });

  describe('Security & Limits', () => {
    it('should set Helmet security headers', async () => {
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const res = await request(GATEWAY_URL).get('/favicon.ico');
      expect(res.headers).toHaveProperty('x-dns-prefetch-control');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should allow CORS requests', async () => {
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const res = await request(GATEWAY_URL)
        .options('/auth/login')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should reject payloads larger than 10mb', async () => {
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const largePayload = Buffer.alloc(10 * 1024 * 1024 + 100).toString();
      const res = await request(GATEWAY_URL)
        .post('/auth/login')
        .send({ username: 'test', data: largePayload });

      expect(res.status).toBe(413);
    });
    it('should respect X-Forwarded-For header when trust proxy is enabled', async () => {
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const loginDto = {
        username: 'throttle-user',
        password: 'Password123!',
        deviceId: 'test-device-id',
      };

      // 1. Exhaust limit for IP "1.1.1.1"
      const tasks: request.Test[] = [];
      for (let i = 0; i < 10; i++) {
        tasks.push(
          request(GATEWAY_URL)
            .post('/auth/login')
            .set('X-Forwarded-For', '1.1.1.1')
            .send(loginDto),
        );
      }
      await Promise.all(tasks);

      // 2. Request from "1.1.1.1" should now fail (429)
      const resFail = await request(GATEWAY_URL)
        .post('/auth/login')
        .set('X-Forwarded-For', '1.1.1.1')
        .send(loginDto);
      expect(resFail.status).toBe(429);

      // 3. Request from "2.2.2.2" should succeed
      const resSuccess = await request(GATEWAY_URL)
        .post('/auth/login')
        .set('X-Forwarded-For', '2.2.2.2')
        .send(loginDto);

      expect(resSuccess.status).not.toBe(429);
    });
  });

  describe('Validation Pipe', () => {
    it('should reject invalid DTO with 400 Bad Request', async () => {
      // To prevent consecutive requests from triggering rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const res = await request(GATEWAY_URL).post('/auth/login').send({
        username: 'invalid-user',
        // Missing password and deviceId
      });

      expect(res.status).toBe(400);
    });

    it('should reject requests with non-whitelisted properties', async () => {
      const res = await request(GATEWAY_URL).post('/auth/login').send({
        username: 'someuser',
        password: 'Password123!',
        deviceId: '123',
        extraField: 'should-fail',
      });

      expect(res.status).toBe(400);
    });
  });
});
