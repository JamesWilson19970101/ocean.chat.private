import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCodes } from '@ocean.chat/common-exceptions';
import { User } from '@ocean.chat/models';
import {
  NATS_CLIENT_INJECTION_TOKEN,
  NatsOpentelemetryTracingModule,
} from '@ocean.chat/nats-opentelemetry-tracing';
import { connect, connection } from 'mongoose';
import { catchError, firstValueFrom, of } from 'rxjs';

import { ErrorResponseDto } from '../../../libs/common-exceptions/src/dto/error-response.dto';

type RpcError = {
  error: ErrorResponseDto;
  message: string;
};

describe('OceanchatUserController (e2e)', () => {
  let client: ClientProxy;

  const testUserDto = {
    username: 'testuser',
    password: '@TestUser123',
    confirmPassword: '@TestUser123',
  };

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

    await connect('mongodb://localhost:27017/oceanchat_test');
  });

  afterAll(async () => {
    await client.close();
    await connection.close();
  });

  // Clean up the users collection after each test to ensure isolation
  afterEach(async () => {
    await connection.collection('users').deleteMany({});
  });

  describe("MessagePattern 'user.create'", () => {
    it('should create a new user successfully', async () => {
      const newUser: Partial<User> = await firstValueFrom(
        client.send('user.create', testUserDto),
      );

      expect(newUser).toBeDefined();
      expect(newUser.username).toBe(testUserDto.username);
      expect(newUser.name).toBe(testUserDto.username);
      expect(newUser).toHaveProperty('_id');
      // Ensure sensitive data like providers/passwordHash is not returned
      expect(newUser).not.toHaveProperty('providers');
    }, 15000);

    it('should throw USERNAME_ALREADY_EXISTS if username is taken', async () => {
      // Create the user first
      await firstValueFrom(client.send('user.create', testUserDto));

      // Attempt to create it again
      const rpcError: RpcError = await firstValueFrom(
        client.send('user.create', testUserDto).pipe(
          catchError((error) => {
            return of({ error });
          }),
        ),
      );
      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.USERNAME_ALREADY_EXISTS);
    });

    it('should throw USERNAME_TOO_SHORT for a short username', async () => {
      const rpcError: RpcError = await firstValueFrom(
        client
          .send('user.create', { ...testUserDto, username: 'a' })
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.USERNAME_TOO_SHORT);
    });

    it('should throw PASSWORD_NO_UPPERCASE for a password without an uppercase letter', async () => {
      const rpcError: RpcError = await firstValueFrom(
        client
          .send('user.create', {
            ...testUserDto,
            password: '@testuser123',
            confirmPassword: '@testuser123',
          })
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.PASSWORD_NO_UPPERCASE);
    });
  });

  describe("MessagePattern 'user.query.profile'", () => {
    let createdUser: Partial<User>;

    beforeEach(async () => {
      createdUser = await firstValueFrom(
        client.send('user.create', testUserDto),
      );
    });

    it('should find a user by their ID', async () => {
      const foundUser: Partial<User> = await firstValueFrom(
        client.send('user.query.profile', { userId: createdUser._id }),
      );

      expect(foundUser).toBeDefined();
      expect(foundUser._id?.toString()).toBe(createdUser._id?.toString());
      expect(foundUser.username).toBe(testUserDto.username);
    });

    it('should return null for a non-existent user ID', async () => {
      const nonExistentId = '605fe2a7e2755b001f57c8a0'; // A valid but non-existent ObjectId
      const result = await firstValueFrom(
        client.send('user.query.profile', { userId: nonExistentId }),
      );
      expect(result).toBeNull();
    });
  });

  describe("MessagePattern 'user.query.byUsername'", () => {
    beforeEach(async () => {
      await firstValueFrom(client.send('user.create', testUserDto));
    });

    it('should find a user by username and return full details', async () => {
      const foundUser: User = await firstValueFrom(
        client.send('user.query.byUsername', {
          username: testUserDto.username,
        }),
      );

      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(testUserDto.username);
      expect(foundUser).toHaveProperty('providers');
      expect(foundUser.providers[0]).toHaveProperty('passwordHash');
    });

    it('should return null for a non-existent username', async () => {
      const result = await firstValueFrom(
        client.send('user.query.byUsername', { username: 'nonexistent' }),
      );
      expect(result).toBeNull();
    });
  });

  describe("MessagePattern 'user.validate.password'", () => {
    let createdUser: Partial<User>;

    beforeEach(async () => {
      createdUser = await firstValueFrom(
        client.send('user.create', testUserDto),
      );
    });

    it('should return the user object for valid credentials', async () => {
      const validatedUser: Partial<User> = await firstValueFrom(
        client.send('user.validate.password', {
          username: testUserDto.username,
          password: testUserDto.password,
        }),
      );

      expect(validatedUser).toBeDefined();
      expect(validatedUser._id?.toString()).toBe(createdUser._id?.toString());
      expect(validatedUser.username).toBe(testUserDto.username);
    });

    it('should return null for an incorrect password', async () => {
      const result = await firstValueFrom(
        client.send('user.validate.password', {
          username: testUserDto.username,
          password: 'wrongpassword',
        }),
      );
      expect(result).toBeNull();
    });

    it('should return null for a non-existent user', async () => {
      const result = await firstValueFrom(
        client.send('user.validate.password', {
          username: 'nonexistentuser',
          password: testUserDto.password,
        }),
      );
      expect(result).toBeNull();
    });
  });
});
