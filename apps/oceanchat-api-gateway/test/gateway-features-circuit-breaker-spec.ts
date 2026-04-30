/**
 * apps/oceanchat-api-gateway/test/gateway-features-circuit-breaker.e2e-spec.ts
 *
 * E2E Tests for Gateway Infrastructure Features:
 * - Circuit Breaker
 *
 * NOTE: This test requires manually stopping the Auth Service to simulate a failure.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import Redis from 'ioredis';
import { connect, connection, Types } from 'mongoose';
import { throwError } from 'rxjs';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { v4 as uuidv4 } from 'uuid';

import { OceanchatApiGatewayModule } from '../src/oceanchat-api-gateway.module';

describe('Gateway Features E2E Tests', () => {
  jest.setTimeout(10000);
  const GATEWAY_URL = 'http://localhost:1996';
  let redisClient: Redis;
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        OceanchatApiGatewayModule.forRoot({
          serviceName: 'test-gateway',
          serviceInstanceId: uuidv4(),
        }),
      ],
    })
      // Mock Auth Client to simulate failure programmatically
      // NOTE: Replace 'AUTH_SERVICE' with the actual injection token used in module
      .overrideProvider('AUTH_SERVICE')
      .useValue({
        send: () => throwError(() => new Error('Simulated Downstream Failure')),
        emit: () => throwError(() => new Error('Simulated Downstream Failure')),
      })
      .compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    // Start the app on port 1996 as requested
    await app.listen(1996);
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
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // clear state of throtter
    const keys = await redisClient.keys('throttler:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    await connection.collection('users').deleteMany({
      username: { $in: ['cb-user'] },
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker when downstream service is unavailable', async () => {
      const password = 'Password123!';
      const hashedPassword = await argon2.hash(password);
      await connection.collection('users').insertOne({
        _id: new Types.ObjectId(),
        username: 'cb-user',
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
        console.warn('⚠️ Circuit Breaker did not open.');
      }

      expect(res.status).toBe(503);
    }, 30000);
  });
});
