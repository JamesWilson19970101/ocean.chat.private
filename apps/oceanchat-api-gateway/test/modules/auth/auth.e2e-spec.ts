import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@ocean.chat/models';
import Redis from 'ioredis';
import { connect, connection } from 'mongoose';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { v4 as uuidv4 } from 'uuid';

import { OceanchatApiGatewayModule } from '../../../src/oceanchat-api-gateway.module';

describe('Auth Module E2E Tests', () => {
  let app: INestApplication<App>;
  let redisClient: Redis;

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
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
    await connection.close();
  });

  afterEach(async () => {
    await connection.collection('users').deleteMany({});
    // login will set access-session & refresh-session
    const accessKeys = await redisClient.keys('access-session:*');
    const refreshKeys = await redisClient.keys('refresh-session:*');
    const allSessionKeys = [...accessKeys, ...refreshKeys];
    if (allSessionKeys.length > 0) {
      await redisClient.del(allSessionKeys);
    }
  });

  describe('/auth/register (POST)', () => {
    const registerDto = {
      username: 'e2e-test-user',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    it('should return created user on successful registration', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201)
        .then((res: { [key: string]: any; body: Partial<User> }) => {
          // 1. Check for existence of auto-generated fields
          expect(res.body).toHaveProperty('_id');
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('updatedAt');

          // 2. Check if returned values match input or defaults
          expect(res.body.username).toEqual(registerDto.username);
          expect(res.body.name).toEqual(registerDto.username);
          expect(res.body.type).toEqual('user');
          expect(res.body.active).toBe(true);
          expect(res.body.status).toEqual('offline');
          expect(res.body.roles).toEqual(['user']);
          expect(res.body.emails).toEqual([]);

          // 3. IMPORTANT: Ensure sensitive data is NOT exposed
          expect(res.body.providers).toBeUndefined();
        });
    });

    it('should fail with 400 if passwords do not match', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerDto, confirmPassword: 'wrong-password' })
        .expect(400)
        .then((res: { body: { message: string } } & { [key: string]: any }) => {
          expect(res.body.message).toContain('Passwords do not match');
        });
    });

    it('should fail with 400 if username already exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400)
        .then(
          (res: { body: { errorCode: string } } & { [key: string]: any }) => {
            expect(res.body.errorCode).toEqual(10001);
          },
        );
    });

    it('should fail with 400 if required fields are missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { username, ...dtoWithoutUsername } = registerDto;
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(dtoWithoutUsername)
        .expect(400);
    });

    it('should fail with 400 if password is too short', () => {
      const shortPasswordDto = {
        ...registerDto,
        password: 's',
        confirmPassword: 's',
      };
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(shortPasswordDto)
        .expect(400)
        .then(
          (res: { body: { errorCode: string } } & { [key: string]: any }) => {
            expect(res.body.errorCode).toEqual(10010);
          },
        );
    });
  });
});
