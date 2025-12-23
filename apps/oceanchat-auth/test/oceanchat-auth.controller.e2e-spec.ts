/* eslint-disable @typescript-eslint/no-unused-vars */
import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCodes, ErrorResponseDto } from '@ocean.chat/common-exceptions';
import { AuthKeyUtil } from '@ocean.chat/cores';
import { NatsOpentelemetryTracingModule } from '@ocean.chat/nats-opentelemetry-tracing';
import { LoginResult, RefreshTokenResult } from '@ocean.chat/types';
import { ITokenStorage } from '@ocean.chat/types';
import Redis from 'ioredis';
import { connect, connection, Types } from 'mongoose';
import * as ms from 'ms';
import { catchError, firstValueFrom, of } from 'rxjs';

type RpcError = {
  error: ErrorResponseDto;
  message: string;
};

describe('OceanchatAuthController (e2e)', () => {
  jest.setTimeout(10000);
  let client: ClientProxy;
  let redisClient: Redis;

  const testUser = {
    username: 'james',
    password: '@James123456',
    confirmPassword: '@James123456',
  };

  const testDeviceId = 'test-device-id';

  const TEST_ACCESS_TOKEN_EXPIRES_IN_MS = ms('1s');
  const TEST_REFRESH_TOKEN_EXPIRES_IN_MS = ms('2s');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NatsOpentelemetryTracingModule.registerAsync([
          {
            useFactory: () => ({
              servers: [process.env.NATS_URL || 'nats://localhost:4222'],
            }),
            name: 'TEST_USER_SERVICE',
          },
        ]),
      ],
    }).compile();

    client = moduleFixture.get<ClientProxy>('TEST_USER_SERVICE');
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
    beforeAll(async () => {
      await firstValueFrom(client.send('user.create', testUser));
    });
    afterAll(async () => {
      await connection.collection('users').deleteMany({});
    });

    afterEach(async () => {
      const keys = await redisClient.keys('auth:user:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    });

    it('should throw an RpcException with wrong password', async () => {
      const payload = {
        username: testUser.username,
        password: 'WrongPassword',
        deviceId: testDeviceId,
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
      expect(rpcEerror.error.errorCode).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('should return tokens and store session in Redis with correct credentials', async () => {
      const payload = {
        username: testUser.username,
        password: testUser.password,
        deviceId: testDeviceId,
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

      // Verify that the session is actually stored in Redis
      const userId: string = response.user._id as string;
      const userKey = AuthKeyUtil.getUserKey(userId);
      const storedSession = await redisClient.hget(userKey, testDeviceId);
      expect(storedSession).not.toBeNull();
      const sessionData = JSON.parse(storedSession as string) as ITokenStorage;
      expect(sessionData.accessToken).toBe(response.accessToken);
      expect(sessionData.refreshToken).toBe(response.refreshToken);
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
      expect(rpcError.error.errorCode).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('should support multiple devices for the same user', async () => {
      // 1. Login with device A
      const payloadA = {
        username: testUser.username,
        password: testUser.password,
        deviceId: 'device-A',
      };
      const responseA: LoginResult = await firstValueFrom(
        client.send('auth.login', payloadA),
      );

      // 2. Login with device B
      const payloadB = {
        username: testUser.username,
        password: testUser.password,
        deviceId: 'device-B',
      };
      await firstValueFrom(client.send('auth.login', payloadB));

      // 3. Verify Redis has both sessions
      const userId = responseA.user._id as string;
      const userKey = AuthKeyUtil.getUserKey(userId);
      const allSessions = await redisClient.hgetall(userKey);

      expect(Object.keys(allSessions)).toHaveLength(2);
      expect(allSessions).toHaveProperty('device-A');
      expect(allSessions).toHaveProperty('device-B');
    });

    it('should update the session when logging in again on the same device', async () => {
      const payload = {
        username: testUser.username,
        password: testUser.password,
        deviceId: testDeviceId,
      };

      // 1. First login
      const response1: LoginResult = await firstValueFrom(
        client.send('auth.login', payload),
      );

      // 2. Second login (same device)
      const response2: LoginResult = await firstValueFrom(
        client.send('auth.login', payload),
      );

      // Tokens should be different (new JTI, new issue time)
      expect(response1.accessToken).not.toBe(response2.accessToken);

      // 3. Verify Redis has the new token
      const userId = response1.user._id as string;
      const userKey = AuthKeyUtil.getUserKey(userId);
      const storedSession = await redisClient.hget(userKey, testDeviceId);

      const sessionData = JSON.parse(storedSession as string) as ITokenStorage;
      expect(sessionData.accessToken).toBe(response2.accessToken);
    });
  });

  describe("MessagePattern 'auth.token.refresh'", () => {
    let refreshToken: string;
    let userId: string;
    const deviceId = 'test-device-refresh';

    beforeAll(async () => {
      // Register
      await firstValueFrom(client.send('user.create', testUser));
    });

    afterAll(async () => {
      await connection.collection('users').deleteMany({});
    });

    beforeEach(async () => {
      const loginPayload = {
        username: testUser.username,
        password: testUser.password,
        deviceId,
      };
      const response = await firstValueFrom<LoginResult>(
        client.send('auth.login', loginPayload),
      );

      refreshToken = response.refreshToken;
      userId = response.user._id as string;
    });

    afterEach(async () => {
      const keys = await redisClient.keys('auth:user:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      const lockKeys = await redisClient.keys('auth:refresh:lock:*');
      if (lockKeys.length > 0) {
        await redisClient.del(lockKeys);
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

      expect(rpcError.error.errorCode).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('should throw an RpcException (10031) if session is missing in Redis (Revoked/Expired)', async () => {
      // Manually revoke the token by deleting its session from Redis
      const userKey = AuthKeyUtil.getUserKey(userId);
      await redisClient.del(userKey);

      const payload = { refreshToken };
      const rpcError: RpcError = await firstValueFrom(
        client.send('auth.token.refresh', payload).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );

      expect(rpcError).toHaveProperty('error');

      expect(rpcError.error.errorCode).toBe(
        ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
      );
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

      expect(rpcError.error.errorCode).toBe(ErrorCodes.UNAUTHORIZED);
    });
  });

  describe("MessagePattern 'auth.logout'", () => {
    let userId: string;
    const deviceId = 'test-device-logout';

    beforeAll(async () => {
      // Register
      await firstValueFrom(client.send('user.create', testUser));
    });

    afterAll(async () => {
      await connection.collection('users').deleteMany({});
    });

    beforeEach(async () => {
      // log in to establish a session
      const loginPayload = {
        username: testUser.username,
        password: testUser.password,
        deviceId,
      };
      const response = await firstValueFrom<LoginResult>(
        client.send('auth.login', loginPayload),
      );
      userId = response.user._id as string;
    });

    afterEach(async () => {
      const keys = await redisClient.keys('auth:user:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    });

    it('should successfully logout and remove session from Redis', async () => {
      // Verify session exists before logout
      const userKey = AuthKeyUtil.getUserKey(userId);
      const initialSession = await redisClient.hget(userKey, deviceId);
      expect(initialSession).not.toBeNull();

      // Perform logout
      const result = await firstValueFrom(
        client.send('auth.logout', { userId, deviceId }),
      );
      expect(result).toBe(1); // hdel returns 1 if field was removed

      // Verify session is gone
      const finalSession = await redisClient.hget(userKey, deviceId);
      expect(finalSession).toBeNull();
    });

    it('should return 0 if session does not exist (Idempotency)', async () => {
      const result = await firstValueFrom(
        client.send('auth.logout', { userId, deviceId: 'unknown-device' }),
      );
      expect(result).toBe(0); // hdel returns 0 if field did not exist
    });

    it('should not affect other devices sessions', async () => {
      const deviceId2 = 'device-2';
      // Login second device
      await firstValueFrom(
        client.send('auth.login', {
          username: testUser.username,
          password: testUser.password,
          deviceId: deviceId2,
        }),
      );

      // Logout first device
      await firstValueFrom(client.send('auth.logout', { userId, deviceId }));

      const userKey = AuthKeyUtil.getUserKey(userId);
      const session1 = await redisClient.hget(userKey, deviceId);
      const session2 = await redisClient.hget(userKey, deviceId2);

      expect(session1).toBeNull(); // Device 1 logged out
      expect(session2).not.toBeNull(); // Device 2 still active
    });
  });
});
