import { ErrorResponseDto } from '@ocean.chat/common-exceptions';
import { User } from '@ocean.chat/models';
import { LoginResult, RefreshTokenResult } from '@ocean.chat/types';
import Redis from 'ioredis';
import { connect, connection } from 'mongoose';
import * as request from 'supertest';

describe('Auth Module E2E Tests', () => {
  const appUrl = 'http://localhost:1994';
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
      return request(appUrl)
        .post('/auth/register')
        .send(registerDto)
        .expect(200)
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
      return request(appUrl)
        .post('/auth/register')
        .send({ ...registerDto, confirmPassword: 'wrong-password' })
        .expect(400)
        .then(
          (
            res: { body: Partial<ErrorResponseDto> } & { [key: string]: any },
          ) => {
            expect(res.body.message).toContain('Passwords do not match');
          },
        );
    });

    it('should fail with 400 if username already exists', async () => {
      await request(appUrl)
        .post('/auth/register')
        .send(registerDto)
        .expect(200);

      return request(appUrl)
        .post('/auth/register')
        .send(registerDto)
        .expect(409)
        .then(
          (
            res: { body: Partial<ErrorResponseDto> } & { [key: string]: any },
          ) => {
            expect(res.body.errorCode).toEqual(10001);
          },
        );
    });

    it('should fail with 400 if required fields are missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { username, ...dtoWithoutUsername } = registerDto;
      return request(appUrl)
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
      return request(appUrl)
        .post('/auth/register')
        .send(shortPasswordDto)
        .expect(400)
        .then(
          (
            res: { body: Partial<ErrorResponseDto> } & { [key: string]: any },
          ) => {
            expect(res.body.errorCode).toEqual(10010);
          },
        );
    });
  });

  describe('/auth/login (POST)', () => {
    const loginDto = {
      username: 'e2e-login-user',
      password: 'Password123!',
      deviceId: 'e2e-login-user',
    };

    // Before each test in this block, register a user to ensure a clean state.
    beforeEach(async () => {
      await request(appUrl).post('/auth/register').send({
        username: 'e2e-login-user',
        password: 'Password123!',
        confirmPassword: loginDto.password,
      });
    });

    it('should return tokens and user on successful login', () => {
      return request(appUrl)
        .post('/auth/login')
        .send(loginDto)
        .expect(200)
        .then((res: { [key: string]: any; body: LoginResult }) => {
          // 1. Check for the presence of tokens and user object
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');

          // 2. Validate the content of the tokens and user object
          expect(typeof res.body.accessToken).toBe('string');
          expect(res.body.accessToken).not.toBe('');
          expect(typeof res.body.refreshToken).toBe('string');
          expect(res.body.refreshToken).not.toBe('');
          expect(res.body.user.username).toEqual(loginDto.username);
          expect(res.body.user).toHaveProperty('_id');

          // 3. Ensure sensitive data is not exposed
          expect(res.body.user).not.toHaveProperty('providers');
        });
    });

    it('should fail with 401 for incorrect password', () => {
      return request(appUrl)
        .post('/auth/login')
        .send({ ...loginDto, password: 'wrong-password' })
        .expect(401)
        .then(
          (res: { [key: string]: any; body: Partial<ErrorResponseDto> }) => {
            expect(res.body.errorCode).toEqual(10030); // UNAUTHORIZED
          },
        );
    });

    it('should fail with 401 for non-existent user', () => {
      return request(appUrl)
        .post('/auth/login')
        .send({ ...loginDto, username: 'non-existent-user' })
        .expect(401)
        .then(
          (res: { [key: string]: any; body: Partial<ErrorResponseDto> }) => {
            expect(res.body.errorCode).toEqual(10030); // UNAUTHORIZED
          },
        );
    });

    it('should fail with 400 if password is not provided', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...dtoWithoutPassword } = loginDto;
      return request(appUrl)
        .post('/auth/login')
        .send(dtoWithoutPassword)
        .expect(400);
    });
  });

  describe('/auth/refresh (POST)', () => {
    const userDto = {
      username: 'refresh-test-user',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    const loginDto = {
      username: userDto.username,
      password: userDto.password,
      deviceId: 'refresh-device',
    };
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      await request(appUrl).post('/auth/register').send(userDto);
      const res: { [key: string]: any; body: LoginResult } = await request(
        appUrl,
      )
        .post('/auth/login')
        .send(loginDto);
      refreshToken = res.body.refreshToken;
      accessToken = res.body.accessToken;
    });

    it('should return new tokens on successful refresh', async () => {
      const res = await request(appUrl)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const body = res.body as RefreshTokenResult;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.accessToken).not.toBe(accessToken);
      expect(body.refreshToken).not.toBe(refreshToken);
    });

    it('should fail with 401 if refresh token is invalid', () => {
      return request(appUrl)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should fail with 401 if refresh token is reused (revoked)', async () => {
      // 1. Refresh once (success) - this invalidates the old refresh token
      await request(appUrl)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // 2. Try to refresh again with the same old token
      return request(appUrl)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('/auth/logout (POST)', () => {
    const userDto = {
      username: 'logout-test-user',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    const loginDto = {
      username: userDto.username,
      password: userDto.password,
      deviceId: 'logout-device',
    };
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      await request(appUrl).post('/auth/register').send(userDto);
      const res: { [key: string]: any; body: LoginResult } = await request(
        appUrl,
      )
        .post('/auth/login')
        .send(loginDto);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should logout successfully', () => {
      return request(appUrl)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should fail with 401 if not authenticated', () => {
      return request(appUrl).post('/auth/logout').expect(401);
    });

    it('should invalidate access token and refresh token after logout', async () => {
      await request(appUrl)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(appUrl)
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      await request(appUrl)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
