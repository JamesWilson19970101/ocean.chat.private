import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCodes } from '@ocean.chat/common-exceptions';
import { ErrorResponseDto } from '@ocean.chat/common-exceptions';
import { connect, connection } from 'mongoose';
import { catchError, firstValueFrom, of } from 'rxjs';

import { CreateUserDto } from '../../src/users/dto/create-user.dto';

type RpcError = {
  error: ErrorResponseDto;
  message: string; // This 'message' property might be the raw NATS message string, or just part of the error structure.
};

const AUTH_CLIENT = 'AUTH_CLIENT';

describe("UsersController 'auth.register' (e2e)", () => {
  let client: ClientProxy;

  const baseUser: CreateUserDto = {
    username: 'testuser',
    password: 'Password123!',
    confirmPassword: 'Password123!',
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
    await connect('mongodb://localhost:27017/oceanchat_test');
  });

  afterAll(async () => {
    await connection.collection('users').deleteMany({});
    await client.close();
    await connection.close();
  });

  afterEach(async () => {
    await connection.collection('users').deleteMany({});
  });

  it('should create a user successfully with valid data and clean up', async () => {
    const result = await firstValueFrom(client.send('auth.register', baseUser));

    expect(result).toHaveProperty('_id');
    expect(result).toHaveProperty('username', baseUser.username);
    expect(result).not.toHaveProperty('providers'); // Ensure sensitive data is not returned

    // Verify in DB
    const dbUser = await connection
      .collection('users')
      .findOne({ username: baseUser.username });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.username).toBe(baseUser.username);
  });

  it('should throw an exception if passwords do not match', async () => {
    const payload: CreateUserDto = {
      ...baseUser,
      confirmPassword: 'WrongPassword',
    };
    const rpcError: RpcError = await firstValueFrom(
      client
        .send('auth.register', payload)
        .pipe(catchError((error) => of({ error }))),
    );

    console.log(rpcError);
    expect(rpcError).toHaveProperty('error');
    expect(rpcError.error.message).toContain(
      'confirmPassword must match password',
    );
  });

  it('should throw an exception if username already exists', async () => {
    // Arrange: create a user first
    await firstValueFrom(client.send('auth.register', baseUser));

    // Act: try to create the same user again
    const rpcError: RpcError = await firstValueFrom(
      client
        .send('auth.register', baseUser)
        .pipe(catchError((error) => of({ error }))),
    );

    // Assert
    expect(rpcError).toHaveProperty('error');
    expect(rpcError.error.errorCode).toBe(ErrorCodes.USERNAME_ALREADY_EXISTS);
  });

  it('should throw an exception for a short username based on settings', async () => {
    const payload = { ...baseUser, username: 'ww' };

    // Act
    const rpcError: RpcError = await firstValueFrom(
      client
        .send('auth.register', payload)
        .pipe(catchError((error) => of({ error }))),
    );

    // Assert
    expect(rpcError).toHaveProperty('error');
    expect(rpcError.error.errorCode).toBe(ErrorCodes.USERNAME_TOO_SHORT);
  });

  it('should throw an exception for a password without a digit based on settings', async () => {
    const payload = {
      ...baseUser,
      password: 'Password!',
      confirmPassword: 'Password!',
    };

    const rpcError: RpcError = await firstValueFrom(
      client
        .send('auth.register', payload)
        .pipe(catchError((error) => of({ error }))),
    );

    expect(rpcError).toHaveProperty('error');
    expect(rpcError.error.errorCode).toBe(ErrorCodes.PASSWORD_NO_DIGIT);
  });

  // --- New Test Cases Below ---

  describe('Username Validation (Detailed)', () => {
    it('should throw an exception for a long username based on settings', async () => {
      // Assuming Accounts_Username_MaxLength is set to a reasonable value, e.g., 30
      const longUsername = 'a'.repeat(31); // 31 characters
      const payload: CreateUserDto = { ...baseUser, username: longUsername };

      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.USERNAME_TOO_LONG);
    });

    it('should throw an exception for a username with invalid characters based on settings', async () => {
      // Assuming Accounts_Username_Regex is set to allow only alphanumeric and underscore
      const invalidUsername = 'user@name';
      const payload: CreateUserDto = { ...baseUser, username: invalidUsername };

      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(
        ErrorCodes.USERNAME_INVALID_CHARACTERS,
      );
    });
  });

  describe('Password Validation (Detailed)', () => {
    it('should throw an exception for a password that is too short based on settings', async () => {
      // Assuming Accounts_Password_MinLength is set to a reasonable value, e.g., 8
      const shortPassword = 'P1!'; // 3 characters
      const payload: CreateUserDto = {
        ...baseUser,
        password: shortPassword,
        confirmPassword: shortPassword,
      };

      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.PASSWORD_TOO_SHORT);
    });

    it('should throw an exception for a password without a lowercase letter based on settings', async () => {
      const noLowercasePassword = 'PASSWORD123!';
      const payload: CreateUserDto = {
        ...baseUser,
        password: noLowercasePassword,
        confirmPassword: noLowercasePassword,
      };

      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.PASSWORD_NO_LOWERCASE);
    });

    it('should throw an exception for a password without an uppercase letter based on settings', async () => {
      const noUppercasePassword = 'password123!';
      const payload: CreateUserDto = {
        ...baseUser,
        password: noUppercasePassword,
        confirmPassword: noUppercasePassword,
      };

      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(ErrorCodes.PASSWORD_NO_UPPERCASE);
    });

    it('should throw an exception for a password without a special character based on settings', async () => {
      const noSpecialCharPassword = 'Password123';
      const payload: CreateUserDto = {
        ...baseUser,
        password: noSpecialCharPassword,
        confirmPassword: noSpecialCharPassword,
      };

      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );

      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.errorCode).toBe(
        ErrorCodes.PASSWORD_NO_SPECIAL_CHAR,
      );
    });
  });

  describe('DTO Validation (Missing Fields)', () => {
    it('should throw an exception for missing username', async () => {
      const payload = { ...baseUser, username: undefined };
      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );
      // ValidationPipe typically returns an array of strings for DTO validation errors
      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.message).toContain('username should not be empty');
    });

    it('should throw an exception for missing password', async () => {
      const payload = { ...baseUser, password: undefined };
      const rpcError: RpcError = await firstValueFrom(
        client
          .send('auth.register', payload)
          .pipe(catchError((error) => of({ error }))),
      );
      expect(rpcError).toHaveProperty('error');
      expect(rpcError.error.message).toContain('password should not be empty');
    });
  });
});
