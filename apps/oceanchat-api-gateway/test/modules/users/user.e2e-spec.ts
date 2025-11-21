import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@ocean.chat/models';
import { LoginResult } from '@ocean.chat/types';
import Redis from 'ioredis';
import { connect, connection } from 'mongoose';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { v4 as uuidv4 } from 'uuid';

import { OceanchatApiGatewayModule } from '../../../src/oceanchat-api-gateway.module';

describe('Users Module E2E Tests', () => {
  let app: INestApplication<App>;
  let redisClient: Redis;

  // Test user data
  const testUser = {
    username: 'e2e-user-profile',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        OceanchatApiGatewayModule.forRoot({
          serviceName: 'test-gateway',
          serviceInstanceId: uuidv4(),
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB_TEST || '15', 10),
    });

    await connect('mongodb://localhost:27017/oceanchat_test');

    // Register and login the user to get a token for protected routes
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testUser.username, password: testUser.password })
      .expect(200);

    accessToken = (loginRes.body as LoginResult).accessToken;
  });

  afterAll(async () => {
    // Clean up the created user and sessions
    await connection.collection('users').deleteMany({});
    const accessKeys = await redisClient.keys('access-session:*');
    const refreshKeys = await redisClient.keys('refresh-session:*');
    const allSessionKeys = [...accessKeys, ...refreshKeys];
    if (allSessionKeys.length > 0) {
      await redisClient.del(allSessionKeys);
    }

    await app.close();
    await redisClient.quit();
    await connection.close();
  });

  describe('/users/me (GET)', () => {
    it('should return the authenticated user profile on success', () => {
      return request(app.getHttpServer())
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
          expect(res.body).not.toHaveProperty('password');
          expect(res.body).not.toHaveProperty('services');
          expect(res.body.providers).toBeUndefined();
        });
    });
  });
});
