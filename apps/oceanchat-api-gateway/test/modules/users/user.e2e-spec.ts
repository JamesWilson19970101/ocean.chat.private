import { User } from '@ocean.chat/models';
import { LoginResult } from '@ocean.chat/types';
import Redis from 'ioredis';
import { connect, connection } from 'mongoose';
import * as request from 'supertest';

describe('Users Module E2E Tests', () => {
  jest.setTimeout(30000);
  const appUrl = 'http://localhost:1994';
  let redisClient: Redis;
  let accessToken: string;

  beforeAll(async () => {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB_TEST || '15', 10),
    });

    await connect('mongodb://localhost:27017/oceanchat_test');

    // Clean up the created user and sessions
    await connection.collection('users').deleteMany({});
    const accessKeys = await redisClient.keys('access-session:*');
    const refreshKeys = await redisClient.keys('refresh-session:*');
    const allSessionKeys = [...accessKeys, ...refreshKeys];
    if (allSessionKeys.length > 0) {
      await redisClient.del(allSessionKeys);
    }
  });

  afterAll(async () => {
    await redisClient.quit();
    await connection.close();
  });

  describe('/users/me (GET)', () => {
    it('should return the authenticated user profile on success', async () => {
      const testUser = {
        username: 'e2e-user-profile',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      await request(appUrl).post('/auth/register').send(testUser).expect(200);

      const loginRes = await request(appUrl)
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
          deviceId: 'test-e2e-user-profile',
        })
        .expect(200);

      accessToken = (loginRes.body as LoginResult).accessToken;

      return request(appUrl)
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res: { [key: string]: any; body: Partial<User> }) => {
          // 1. Check for expected fields
          expect(res.body).toHaveProperty('_id');
          expect(res.body.username).toEqual(testUser.username);
          expect(res.body.name).toEqual(testUser.username);
          expect(res.body.roles).toEqual(['user']);

          // 2. IMPORTANT: Ensure sensitive data is NOT exposed
          expect(res.body).not.toHaveProperty('providers');
        });
    });
  });
});
