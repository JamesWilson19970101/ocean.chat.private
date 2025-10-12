import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCodes } from '@ocean.chat/common-exceptions';
import { ErrorResponseDto } from '@ocean.chat/common-exceptions';
import { connect, connection } from 'mongoose';
import { firstValueFrom } from 'rxjs';

import { CreateUserDto } from '../../src/users/dto/create-user.dto';

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

  it('should create a user successfully with valid data', async () => {
    const result = await firstValueFrom(client.send('auth.register', baseUser));

    // Assert: Check if the response and service calls are correct
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
    const payload = { ...baseUser, confirmPassword: 'WrongPassword' };
    const response: { error: { message: string[] } } = await firstValueFrom(
      client.send('auth.register', payload),
    );

    expect(response).toHaveProperty('error');
    expect(response.error.message).toContain('Passwords do not match');
  });

  it('should throw an exception if username already exists', async () => {
    // Arrange: create a user first
    await firstValueFrom(client.send('auth.register', baseUser));

    // Act: try to create the same user again
    const response: { error: ErrorResponseDto; message: string } =
      await firstValueFrom(client.send('auth.register', baseUser));

    // Assert
    expect(response).toHaveProperty('error.message');
    const errorDetails = JSON.parse(response.error.message as string);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(errorDetails.errorCode).toBe(ErrorCodes.USERNAME_ALREADY_EXISTS);
  });

  it('should throw an exception for a short username based on settings', async () => {
    const payload = { ...baseUser, username: 'ww' };

    // Act
    const response: { error: ErrorResponseDto; message: string } =
      await firstValueFrom(client.send('auth.register', payload));

    // Assert
    expect(response).toHaveProperty('error.message');
    const errorDetails = JSON.parse(response.error.message as string);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(errorDetails.errorCode).toBe(ErrorCodes.USERNAME_TOO_SHORT);
  });

  it('should throw an exception for a password without a digit based on settings', async () => {
    const payload = {
      ...baseUser,
      password: 'Password!',
      confirmPassword: 'Password!',
    };

    const response: { error: ErrorResponseDto; message: string } =
      await firstValueFrom(client.send('auth.register', payload));

    expect(response).toHaveProperty('error');
    const errorDetails = JSON.parse(response.error.message as string);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(errorDetails.errorCode).toBe(ErrorCodes.PASSWORD_NO_DIGIT);
  });
});
