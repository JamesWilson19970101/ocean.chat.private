/* eslint-disable @typescript-eslint/no-unused-vars */
import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NATS_CLIENT_INJECTION_TOKEN,
  NatsOpentelemetryTracingModule,
} from '@ocean.chat/nats-opentelemetry-tracing';
import Redis from 'ioredis';
import { connect, connection, Types } from 'mongoose';
import * as ms from 'ms';
import { catchError, firstValueFrom, of } from 'rxjs';

import { ErrorResponseDto } from '../../../libs/common-exceptions/src/dto/error-response.dto';
import {
  LoginResult,
  RefreshTokenResult,
} from '..//src/common/types/auth.types';
type RpcError = {
  error: ErrorResponseDto;
  message: string;
};

describe('OceanchatAuthController (e2e)', () => {
  let client: ClientProxy;
  let redisClient: Redis;

  const testUser = {
    username: 'james',
    password: '@James123456',
    confirmPassword: '@James123456',
  };

  const TEST_ACCESS_TOKEN_EXPIRES_IN_MS = ms('1s');
  const TEST_REFRESH_TOKEN_EXPIRES_IN_MS = ms('2s');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NatsOpentelemetryTracingModule.register({
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        }),
      ],
    }).compile();

    client = moduleFixture.get<ClientProxy>(NATS_CLIENT_INJECTION_TOKEN);
    await client.connect();

    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB_TEST || '15', 10),
    });

    await connect('mongodb://localhost:27017/oceanchat_test');
  });

  afterAll(async () => {
    await client.close();
    await redisClient.quit();
    await connection.close();
  });

  describe("MessagePattern 'auth.login'", () => {
    beforeEach(async () => {
      await firstValueFrom(client.send('user.create', testUser));
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

    it('should throw an RpcException with wrong password', async () => {
      const payload = {
        username: testUser.username,
        password: 'WrongPassword',
      };

      const rpcEerror: RpcError = await firstValueFrom(
        client.send('auth.login', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );

      // The error from BaseRpcException is nested inside the 'error' property.
      expect(rpcEerror).toHaveProperty('error');
      // The error message from the microservice is a JSON string, so I need to parse it.
      expect(rpcEerror.error.errorCode).toBe(10030);
    });

    it('should return access and refresh tokens with correct credentials', async () => {
      const payload = {
        username: testUser.username,
        password: testUser.password,
      };

      const response: LoginResult = await firstValueFrom(
        client.send('auth.login', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );

      expect(response).toHaveProperty('accessToken');
      expect(response).toHaveProperty('refreshToken');

      expect(typeof response.accessToken).toBe('string');
      expect(response).toHaveProperty('user');

      expect(response.user).toHaveProperty('username', testUser.username);

      expect(response.user).toHaveProperty('_id');
    });

    it('should throw an RpcException for a non-existent username', async () => {
      const payload = {
        username: 'nonexistentuser',
        password: testUser.password,
      };

      const rpcError: RpcError = await firstValueFrom(
        client.send('auth.login', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(10030);
    });
  });

  describe("MessagePattern 'auth.token.validate'", () => {
    let accessToken: string;
    let userId: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register and log in to get a valid token
      await firstValueFrom(client.send('user.create', testUser));
      const loginPayload = {
        username: testUser.username,
        password: testUser.password,
      };
      const response: LoginResult = await firstValueFrom<LoginResult>(
        client.send('auth.login', loginPayload),
      );
      accessToken = response.accessToken;
      refreshToken = response.refreshToken;
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

    it('should return user payload for a valid token', async () => {
      const payload = {
        token: accessToken,
      };
      const response = await firstValueFrom(
        client.send('auth.token.validate', payload),
      );
      expect(response).toHaveProperty('sub'); // user id
      expect(response).toHaveProperty('username', 'james');
    });

    it('should throw an RpcException for an invalid token', async () => {
      const payload = { token: 'invalid.token.string' };
      const rpcError: RpcError = await firstValueFrom(
        client.send('auth.token.validate', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );
      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(10030);
    });
  });

  describe("MessagePattern 'auth.token.refresh'", () => {
    let refreshToken: string;

    let userId: string;

    beforeEach(async () => {
      // Register and log in to get a valid refresh token
      await firstValueFrom(client.send('user.create', testUser));
      const loginPayload = {
        username: testUser.username,
        password: testUser.password,
      };
      const response = await firstValueFrom<{
        refreshToken: string;
        accessToken: string;
        user: { _id: string };
      }>(client.send('auth.login', loginPayload));

      refreshToken = response.refreshToken;
      // accessToken = response.accessToken;
      userId = response.user._id;
    });

    afterEach(async () => {
      await connection.collection('users').deleteMany({});
      const accessKeys = await redisClient.keys('access-session:*');
      const refreshKeys = await redisClient.keys('refresh-session:*');
      const allSessionKeys = [...accessKeys, ...refreshKeys];
      if (allSessionKeys.length > 0) {
        await redisClient.del(allSessionKeys);
      }
    });

    it('should return new tokens for a valid refresh token', async () => {
      const payload = { refreshToken };
      const response: RefreshTokenResult = await firstValueFrom(
        client.send('auth.token.refresh', payload),
      );

      expect(response).toHaveProperty('accessToken');
      expect(response).toHaveProperty('refreshToken');

      expect(response.refreshToken).not.toBe(refreshToken); // Should be a new token
    });

    it('should throw an RpcException for an invalid refresh token', async () => {
      const payload = { refreshToken: 'invalid.refresh.token' };
      const rpcError: RpcError = await firstValueFrom(
        client.send('auth.token.refresh', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );
      expect(rpcError).toHaveProperty('error');

      expect(rpcError.error.errorCode).toBe(10030);
    });

    it('should throw an RpcException for a revoked refresh token', async () => {
      // Manually revoke the token by deleting its session from Redis
      const decoded = await firstValueFrom<{ jti: string }>(
        client.send('auth.token.decode', { token: refreshToken }), // Assuming you have a decode helper or know the structure
      );
      await redisClient.del(`refresh-session:${decoded.jti}`);

      const payload = { refreshToken };
      const rpcError: RpcError = await firstValueFrom(
        client.send('auth.token.refresh', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );

      expect(rpcError).toHaveProperty('error');

      expect(rpcError.error.errorCode).toBe(10031);
    });

    it('should throw an RpcException if the user does not exist anymore', async () => {
      // Delete the user from the database
      await connection.collection('users').deleteOne({
        _id: new Types.ObjectId(userId),
      });

      const payload = { refreshToken };
      const rpcError: RpcError = await firstValueFrom(
        client.send('auth.token.refresh', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );

      expect(rpcError).toHaveProperty('error');

      expect(rpcError.error.errorCode).toBe(10030);
    });
  });
});
