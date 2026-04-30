/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import Redis from 'ioredis';
import { connect, connection, disconnect } from 'mongoose';
import {
  connect as natsConnect,
  // headers,
  NatsConnection,
  StringCodec,
} from 'nats';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

describe('Auth Module Pragmatic E2E Tests (Gateway -> Auth -> NATS)', () => {
  jest.setTimeout(30000);
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';
  let redisClient: Redis;
  let nc: NatsConnection;
  const sc = StringCodec();

  /**
   * Helper to wait for a NATS message on a specific subject.
   */
  function waitForNatsMessage(subject: string, timeoutMs = 3000): Promise<any> {
    return new Promise((resolve, reject) => {
      const sub = nc.subscribe(subject, { max: 1 });
      const timer = setTimeout(() => {
        sub.unsubscribe();
        reject(
          new Error(`Timeout waiting for NATS message on subject: ${subject}`),
        );
      }, timeoutMs);

      (async () => {
        for await (const m of sub) {
          clearTimeout(timer);

          const rawParsed = JSON.parse(sc.decode(m.data));

          const normalizedData =
            rawParsed && typeof rawParsed === 'object' && 'data' in rawParsed
              ? rawParsed.data
              : rawParsed;

          resolve({
            subject: m.subject,
            raw: rawParsed,
            data: normalizedData,
            headers: m.headers,
          });
        }
      })().catch(reject);
    });
  }

  beforeAll(async () => {
    // 1. Setup Environment (Real Redis, Real Mongo, Real NATS)
    const testRedisDb = '15';
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    const mongoUri =
      process.env.DATABASE_URI || 'mongodb://localhost:27017/oceanchat_test';

    process.env.REDIS_DB = testRedisDb;
    process.env.NATS_URL = natsUrl;
    process.env.DATABASE_URI = mongoUri;

    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(testRedisDb, 10),
    });

    await connect(mongoUri);
    nc = await natsConnect({ servers: natsUrl });
  });

  afterAll(async () => {
    await redisClient.quit();
    await connection.close();
    await disconnect();
    await nc.close();
  });

  afterEach(async () => {
    await connection.collection('users').deleteMany({});
    const keys = await redisClient.keys('auth:user:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    const idempotencyKeys = await redisClient.keys('idempotency:*');
    if (idempotencyKeys.length > 0) {
      await redisClient.del(idempotencyKeys);
    }
  });

  describe('Core E2E Paths (Register, Login, Refresh, Logout)', () => {
    const userDto = {
      username: 'e2e-gateway-user',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    const loginDto = {
      username: userDto.username,
      password: userDto.password,
      deviceId: 'gateway-device-1',
    };

    it('1. POST /auth/register - Should register a new user', async () => {
      const res = await request(GATEWAY_URL)
        .post('/auth/register')
        .send(userDto)
        .expect(200);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.username).toEqual(userDto.username);
      expect(res.body.roles).toEqual(['user']);
      expect(res.body.providers).toBeUndefined(); // Safe DTO
    });

    it('2. POST /auth/login - Should return Access Token and set HttpOnly Refresh Token cookie', async () => {
      await request(GATEWAY_URL).post('/auth/register').send(userDto);

      const natsPromise = waitForNatsMessage('auth.event.user.loggedIn');

      const res = await request(GATEWAY_URL).post('/auth/login').send(loginDto);

      if (res.status !== 200) {
        console.error('LOGIN FAILED:', res.body);
      }
      expect(res.status).toBe(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.username).toEqual(loginDto.username);

      // Verify HttpOnly Cookie
      const cookies = (res.headers['set-cookie'] as unknown as string[]) || [];
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies[0]).toContain('refresh_token=');
      expect(cookies[0]).toContain('HttpOnly');

      // Verify NATS Event Published
      const publishedMsg = await natsPromise;
      expect(publishedMsg.raw.pattern).toBe('auth.event.user.loggedIn');
      expect(publishedMsg.data.userId).toBe(res.body.user._id);
    });

    it('3. POST /auth/refresh - Should rotate tokens and publish revoke event', async () => {
      await request(GATEWAY_URL).post('/auth/register').send(userDto);
      const loginRes = await request(GATEWAY_URL)
        .post('/auth/login')
        .send(loginDto);
      const initialAt = loginRes.body.accessToken;
      const initialRtCookie = ((loginRes.headers[
        'set-cookie'
      ] as unknown as string[]) || [])[0].split(';')[0];

      const natsPromise = waitForNatsMessage('auth.jwt.revoke');

      const refreshRes = await request(GATEWAY_URL)
        .post('/auth/refresh')
        .set('Cookie', [initialRtCookie])
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.accessToken).not.toBe(initialAt);

      const newCookies =
        (refreshRes.headers['set-cookie'] as unknown as string[]) || [];
      const newRtCookie = newCookies[0].split(';')[0];
      expect(newRtCookie).not.toBe(initialRtCookie);

      // Verify NATS Revoke Event for the Old Access Token
      const publishedMsg = await natsPromise;
      expect(publishedMsg.data.jti).toBeDefined();
    });

    it('4. POST /auth/logout - Should clear session and cookie', async () => {
      await request(GATEWAY_URL).post('/auth/register').send(userDto);
      const loginRes = await request(GATEWAY_URL)
        .post('/auth/login')
        .send(loginDto);
      const accessToken = loginRes.body.accessToken;

      const natsPromise = waitForNatsMessage('auth.jwt.revoke');

      const logoutRes = await request(GATEWAY_URL)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify Cookie is cleared
      const cookies =
        (logoutRes.headers['set-cookie'] as unknown as string[]) || [];
      expect(cookies[0]).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');

      // Verify Revoke Event
      const publishedMsg = await natsPromise;
      expect(publishedMsg.data.jti).toBeDefined();
    });
  });

  describe('Idempotency & Concurrency (Anti-Breakdown)', () => {
    it('Scenario 1: HTTP Request Level Idempotency (Concurrent Writes)', async () => {
      const idempotencyKey = uuidv4();
      const registerDto = {
        username: 'idempotent-user-123',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      // Fire 3 concurrent registration requests with the SAME idempotency key
      const requests = Array.from({ length: 3 }).map(() =>
        request(GATEWAY_URL)
          .post('/auth/register')
          .set('idempotency-key', idempotencyKey)
          .send(registerDto),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // 1 should succeed (200 OK), others should be blocked by idempotency (409 Conflict)
      // Note: If the first succeeds very fast, the others might return the cached 200 OK.
      // We will assert that exactly 1 user was created in the DB.

      const successCount = statuses.filter((s) => s === 200).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Because the actual user creation takes time, the lock will hold and block the others with 409.
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);

      const usersInDb = await connection
        .collection('users')
        .countDocuments({ username: 'idempotent-user-123' });
      expect(usersInDb).toBe(1);
    });

    it('Scenario 2: NATS Consumer Redelivery Idempotency (Simulating BaseNatsSubscriber)', async () => {
      // Since Gateway is running externally, we publish a NATS message directly
      // and verify if the idempotency lock correctly prevents double-processing in Redis.

      const js = nc.jetstream();
      const jti = uuidv4();

      const mockEvent = { jti, exp: Math.floor(Date.now() / 1000) + 3600 };

      const payload = sc.encode(JSON.stringify(mockEvent));

      // 1st Delivery (First event arrives)
      await js.publish('auth.jwt.revoke', payload);

      // 2nd Delivery (Simulated duplicated business event or redelivery without msgId)
      await js.publish('auth.jwt.revoke', payload);

      // Give the external Gateway a moment to process the messages
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify the idempotency key was created in Redis
      const idempotencyKey = `idempotency:auth.jwt.revoke:${jti}`;
      const isIdempotencyKeySet = await redisClient.exists(idempotencyKey);
      expect(isIdempotencyKeySet).toBe(1);
    });
  });
});
