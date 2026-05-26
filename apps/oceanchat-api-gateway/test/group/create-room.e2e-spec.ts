/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'reflect-metadata';

import { GroupType } from '@ocean.chat/types';
import Redis from 'ioredis';
import { connect, connection, disconnect } from 'mongoose';
import { connect as natsConnect, NatsConnection, StringCodec } from 'nats';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

describe('Group Module Pragmatic E2E Tests (Gateway -> Group -> NATS)', () => {
  jest.setTimeout(30000);
  const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:1994';
  let redisClient: Redis;
  let nc: NatsConnection;

  const user1 = {
    username: `e2e-gc-${uuidv4().substring(0, 8)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };
  const user2 = {
    username: `e2e-gm-${uuidv4().substring(0, 8)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  let user1Token: string;
  let user1Id: string;
  let user2Id: string;

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

    // Register User 1
    const res1 = await request(GATEWAY_URL).post('/auth/register').send(user1);

    if (res1.status !== 200) {
      console.error('User1 Registration Failed:', res1.body);
    }
    expect(res1.status).toBe(200);
    user1Id = res1.body._id;

    // Register User 2
    const res2 = await request(GATEWAY_URL)
      .post('/auth/register')
      .send(user2)
      .expect(200);
    user2Id = res2.body._id;

    // Login User 1
    const loginRes = await request(GATEWAY_URL)
      .post('/auth/login')
      .send({
        username: user1.username,
        password: user1.password,
        deviceId: 'device-1',
      })
      .expect(200);

    user1Token = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await redisClient.quit();
    await connection.close();
    await disconnect();
    await nc.close();
  });

  afterEach(async () => {
    await connection.collection('groups').deleteMany({});
    const idempotencyKeys = await redisClient.keys('idempotency:*');
    if (idempotencyKeys.length > 0) {
      await redisClient.del(idempotencyKeys);
    }
  });

  describe('Create Group Flow & Idempotency', () => {
    it('1. Should create a private group successfully', async () => {
      const createDto = {
        type: GroupType.PRIVATE_GROUP,
        name: 'Test Private Group',
        members: [user2Id],
      };

      const res = await request(GATEWAY_URL)
        .post('/groups/create')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(createDto)
        .expect(201);

      expect(res.body).toHaveProperty('groupId');
      expect(res.body.name).toEqual('Test Private Group');
      expect(res.body.type).toEqual(GroupType.PRIVATE_GROUP);
    });

    it('2. Should handle HTTP Request Level Idempotency (Concurrent Writes)', async () => {
      const idempotencyKey = uuidv4();
      const createDto = {
        type: GroupType.PRIVATE_GROUP,
        name: 'Idempotent Group',
        members: [user2Id],
      };

      // Fire 3 concurrent creation requests with the SAME idempotency key
      const requests = Array.from({ length: 3 }).map(() =>
        request(GATEWAY_URL)
          .post('/groups/create')
          .set('Authorization', `Bearer ${user1Token}`)
          .set('idempotency-key', idempotencyKey)
          .send(createDto),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);

      const groupsInDb = await connection
        .collection('groups')
        .countDocuments({ name: 'Idempotent Group' });
      expect(groupsInDb).toBe(1);
    });
  });
});
