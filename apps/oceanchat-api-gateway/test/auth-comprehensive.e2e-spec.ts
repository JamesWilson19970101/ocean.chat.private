/* eslint-disable */
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { MongoClient, Db } from 'mongodb';
import * as WebSocket from 'ws';
import {
  MonkeyFramer,
  MonkeyCmd,
  AuthReq,
  AuthAck,
  ExceptionAck,
} from '@ocean.chat/monkey';

/**
 * @file Comprehensive Auth Flow E2E Test Suite
 *
 * Dumbbell Strategy (High ROI Only):
 * Black-Box E2E against LIVE endpoints, skipping DI overhead.
 * Asserts against real Redis/MongoDB side-effects.
 */
describe('Comprehensive Auth Flow E2E (Live System)', () => {
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';
  const WS_URL = process.env.WS_GATEWAY_URL || 'ws://localhost:1996/monkey';
  const REDIS_URI = process.env.REDIS_URL || 'redis://localhost:6379/0';
  const MONGO_URI =
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/oceanchat_test?directConnection=true';

  let redisClient: Redis;
  let mongoClient: MongoClient;
  let db: Db;

  const testUser = {
    username: `user_${uuidv4().substring(0, 8)}`,
    password: 'StrongPassword123!',
    deviceId: 'test-device-ws',
  };

  let accessToken: string;
  let wsClient: WebSocket;

  beforeAll(async () => {
    // Connect directly to the real infrastructure
    redisClient = new Redis(REDIS_URI);
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db();
  });

  afterAll(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    await redisClient.quit();
    await mongoClient.close();
  });

  describe('Phase 1: Short Connection (API Gateway)', () => {
    const idempotencyKey = uuidv4();

    it('should register successfully and strictly enforce idempotency', async () => {
      // Act 1: First request
      const res1 = await request(GATEWAY_URL)
        .post('/auth/register')
        .set('idempotency-key', idempotencyKey)
        .send({
          username: testUser.username,
          password: testUser.password,
          confirmPassword: testUser.password,
        });

      expect(res1.status).toBe(200);

      // Act 2: Second request with exact same idempotency key
      const res2 = await request(GATEWAY_URL)
        .post('/auth/register')
        .set('idempotency-key', idempotencyKey)
        .send({
          username: testUser.username,
          password: testUser.password,
          confirmPassword: testUser.password,
        });

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);

      // Verify side-effects directly in Real MongoDB
      const usersCount = await db
        .collection('users')
        .countDocuments({ username: testUser.username });
      expect(usersCount).toBe(1); // Ensure only 1 user document was actually created
    });

    it('should login successfully and return JWT access token', async () => {
      const res = await request(GATEWAY_URL).post('/auth/login').send({
        username: testUser.username,
        password: testUser.password,
        deviceId: testUser.deviceId,
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;

      // Verify Access Token works on a protected route
      const meRes = await request(GATEWAY_URL)
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.username).toBe(testUser.username);
    });

    it('should enforce rate limiting (throttling) on the login endpoint', async () => {
      const uniqueIp = '192.168.1.200'; // Unique IP to not interfere with other tests

      const requests = Array.from({ length: 15 }).map(() =>
        request(GATEWAY_URL)
          .post('/auth/login')
          .set('X-Forwarded-For', uniqueIp)
          .send({
            username: testUser.username,
            password: testUser.password,
            deviceId: 'flood',
          }),
      );

      const responses = await Promise.all(requests);

      // At least one request should be blocked due to > 10 req/s config
      const throttled = responses.some((res) => res.status === 429);
      expect(throttled).toBe(true);
    });
  });

  describe('Phase 2: Long Connection (WebSocket Gateway)', () => {
    it('should connect, handshake via AUTH_REQ, and receive AUTH_ACK', (done) => {
      wsClient = new WebSocket(WS_URL);

      wsClient.on('open', () => {
        // Construct Monkey Protocol AUTH_REQ payload
        const payload = Buffer.from(
          AuthReq.encode({
            deviceType: 'Desktop',
            deviceId: testUser.deviceId,
            jwt: accessToken,
            supportedVersions: [1],
          }).finish(),
        );

        // Frame the payload with Monkey Header
        const buffer = MonkeyFramer.frameWSMessage(
          {
            cmd: MonkeyCmd.AUTH_REQ,
            reqId: 1,
            flags: 0,
          },
          payload,
        );
        wsClient.send(buffer, { binary: true });
      });

      wsClient.on('message', (data: Buffer) => {
        try {
          const { header, payload } = MonkeyFramer.unframeWSMessage(data);

          if (header.cmd === MonkeyCmd.AUTH_ACK) {
            const authAck = AuthAck.decode(payload);
            expect(authAck.userId).toMatch(/.+/);
            done();
          } else if (header.cmd === MonkeyCmd.EXCEPTION_ACK) {
            const exceptionAck = ExceptionAck.decode(payload);
            done(
              new Error(
                `Received EXCEPTION_ACK: ${exceptionAck.message} (Code: ${exceptionAck.errorCode})`,
              ),
            );
          } else {
            done(
              new Error(
                `Unexpected command received: 0x${header.cmd.toString(16)}`,
              ),
            );
          }
        } catch (error) {
          done(error);
        }
      });

      wsClient.on('error', (err) => done(err));
    }, 10000); // 10s timeout
  });
});
