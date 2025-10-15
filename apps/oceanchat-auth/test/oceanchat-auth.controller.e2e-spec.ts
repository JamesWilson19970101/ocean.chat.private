/* eslint-disable @typescript-eslint/no-unused-vars */
import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { connect, connection, Types } from 'mongoose';
import { catchError, firstValueFrom, of } from 'rxjs';
const AUTH_CLIENT = 'AUTH_CLIENT';

describe('OceanchatAuthController (e2e)', () => {
  let client: ClientProxy;
  let redisClient: Redis;

  const testUser = {
    username: 'james',
    password: 'James123456',
    confirmPassword: 'James123456',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ClientsModule.register([
          {
            name: AUTH_CLIENT,
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL || 'nats://localhost:4222'],
            },
          },
        ]),
      ],
    }).compile();

    client = moduleFixture.get<ClientProxy>(AUTH_CLIENT);
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

  // describe("MessagePattern 'auth.login'", () => {
  //   beforeEach(async () => {
  //     await firstValueFrom(client.send('auth.register', testUser));
  //   });

  //   afterEach(async () => {
  //     await connection.collection('users').deleteMany({});
  //     await redisClient.flushdb();
  //   });

  //   it('should throw an RpcException with wrong password', async () => {
  //     const payload = {
  //       username: testUser.username,
  //       password: 'WrongPassword',
  //     };

  //     const response = await firstValueFrom(client.send('auth.login', payload));

  //     // The error from BaseRpcException is nested inside the 'error' property.
  //     expect(response).toHaveProperty('error');
  //     // The error message from the microservice is a JSON string, so we need to parse it.

  //     const errorDetails = JSON.parse(response.error.message);

  //     expect(errorDetails.message).toBe('Invalid credentials');
  //   });

  //   it('should return access and refresh tokens with correct credentials', async () => {
  //     const payload = {
  //       username: testUser.username,
  //       password: testUser.password,
  //     };

  //     const response = await firstValueFrom(client.send('auth.login', payload));

  //     expect(response).toHaveProperty('accessToken');
  //     expect(response).toHaveProperty('refreshToken');

  //     expect(typeof response.accessToken).toBe('string');
  //     expect(response).toHaveProperty('user');

  //     expect(response.user).toHaveProperty('username', testUser.username);

  //     expect(response.user).toHaveProperty('_id');
  //   });
  // });

  describe("MessagePattern 'auth.token.validate'", () => {
    let accessToken: string;

    let refreshToken: string;

    beforeEach(async () => {
      // Register and log in to get a valid token
      await firstValueFrom(client.send('auth.register', testUser));
      const loginPayload = {
        username: testUser.username,
        password: testUser.password,
      };
      const response = await firstValueFrom<{
        accessToken: string;
        refreshToken: string;
      }>(client.send('auth.login', loginPayload));
      accessToken = response.accessToken;
      refreshToken = response.refreshToken;
    });

    afterEach(async () => {
      await connection.collection('users').deleteMany({});
      await redisClient.flushdb();
    });

    // it('should return user payload for a valid token', async () => {
    //   const payload = {
    //     token: accessToken,
    //   };
    //   const response = await firstValueFrom(
    //     client.send('auth.token.validate', payload),
    //   );
    //   expect(response).toHaveProperty('sub'); // user id
    //   expect(response).toHaveProperty('username', 'james');
    // });

    it('should throw an RpcException for an invalid token', async () => {
      const payload = { token: 'invalid.token.string' };
      const errorDetails = await firstValueFrom(
        client
          .send('auth.token.validate', payload)
          .pipe(catchError((err) => of(err))),
      );
      console.log(errorDetails);
      expect(errorDetails).toHaveProperty('error');
      const message = JSON.parse(errorDetails.error.message);
      expect(message.message).toBe('Unauthorized');
    });
  });

  describe("MessagePattern 'auth.token.refresh'", () => {
    let refreshToken: string;

    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register and log in to get a valid refresh token
      await firstValueFrom(client.send('auth.register', testUser));
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
      accessToken = response.accessToken;
      userId = response.user._id;
    });

    afterEach(async () => {
      await connection.collection('users').deleteMany({});
      await redisClient.flushdb();
    });

    // it('should return new tokens for a valid refresh token', async () => {
    //   const payload = { refreshToken };
    //   const response = await firstValueFrom(
    //     client.send('auth.token.refresh', payload),
    //   );

    //   expect(response).toHaveProperty('accessToken');
    //   expect(response).toHaveProperty('refreshToken');

    //   expect(response.refreshToken).not.toBe(refreshToken); // Should be a new token
    // });

    // it('should throw an RpcException for an invalid refresh token', async () => {
    //   const payload = { refreshToken: 'invalid.refresh.token' };
    //   const response = await firstValueFrom(
    //     client.send('auth.token.refresh', payload),
    //   );

    //   expect(response).toHaveProperty('error');

    //   const errorDetails = JSON.parse(response.error.message);

    //   expect(errorDetails.message).toBe('UNAUTHORIZED');
    // });

    // it('should throw an RpcException for a revoked refresh token', async () => {
    //   // Manually revoke the token by deleting its session from Redis
    //   const decoded = await firstValueFrom<{ jti: string }>(
    //     client.send('auth.token.decode', { token: refreshToken }), // Assuming you have a decode helper or know the structure
    //   );
    //   await redisClient.del(`refresh-session:${decoded.jti}`);

    //   const payload = { refreshToken };
    //   const response = await firstValueFrom(
    //     client.send('auth.token.refresh', payload),
    //   );

    //   console.log('Response:', response);

    //   expect(response).toHaveProperty('error');

    //   const errorDetails = JSON.parse(response.error.message);

    //   expect(errorDetails.message).toBe('UNAUTHORIZED');
    // });

    // it('should throw an RpcException if the user does not exist anymore', async () => {
    //   // Delete the user from the database
    //   await connection.collection('users').deleteOne({
    //     _id: new Types.ObjectId(userId),
    //   });

    //   const payload = { refreshToken };
    //   const response = await firstValueFrom(
    //     client.send('auth.token.refresh', payload),
    //   );

    //   expect(response).toHaveProperty('error');

    //   const errorDetails = JSON.parse(response.error.message);

    //   expect(errorDetails.message).toBe('未找到用户');
    // });
  });
  // Helper describe block for decoding token to get JTI, assuming no public decode endpoint
  // This is a bit of a hack for testing. A dedicated `decode` endpoint would be cleaner.
  // describe("MessagePattern 'auth.token.decode'", () => {
  //   it('should decode a token', async () => {
  //     // First, register the user so we can log in
  //     await firstValueFrom(client.send('auth.register', testUser));
  //     const loginPayload = {
  //       username: testUser.username,
  //       password: testUser.password,
  //     };

  //     const response = await firstValueFrom(
  //       client.send('auth.login', loginPayload),
  //     );
  //     expect(response).toHaveProperty('refreshToken');
  //     const decoded = await firstValueFrom(
  //       client.send('auth.token.decode', { token: response.refreshToken }),
  //     );

  //     expect(decoded).toHaveProperty('sub');
  //     expect(decoded).toHaveProperty('jti');
  //   });
  // });
});
