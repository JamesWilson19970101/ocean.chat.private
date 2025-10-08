import { INestMicroservice, UnauthorizedException } from '@nestjs/common';
import {
  ClientProxy,
  ClientsModule,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';

import { OceanchatAuthController } from '../src/oceanchat-auth.controller';
import { OceanchatAuthService } from '../src/oceanchat-auth.service';
import { JwtStrategy } from '../src/strategies/jwt.strategy';
import { LocalStrategy } from '../src/strategies/local.strategy';

describe('OceanchatAuthController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  // Mock implementations for our service and strategies
  const mockAuthService = {
    login: jest.fn(),
  };

  const mockLocalStrategy = {
    validate: jest.fn(),
  };

  const mockJwtStrategy = {
    validate: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule, // PassportModule is needed for AuthGuard
        ClientsModule.register([
          {
            name: 'AUTH_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: { servers: ['nats://localhost:4222'] },
          },
        ]),
      ],
      controllers: [OceanchatAuthController],
      // 1. Provide the REAL strategies so they can be instantiated and registered.
      providers: [OceanchatAuthService, LocalStrategy, JwtStrategy],
    })
      // 2. NOW, override the real providers with your mock objects.
      .overrideProvider(OceanchatAuthService)
      .useValue(mockAuthService)
      .overrideProvider(LocalStrategy)
      .useValue(mockLocalStrategy)
      .overrideProvider(JwtStrategy)
      .useValue(mockJwtStrategy)
      .compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: { servers: ['nats://localhost:4222'] },
    });
    await app.listen();

    client = app.get('AUTH_SERVICE_CLIENT');
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  // Reset mocks before each test to ensure test isolation
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // --- Tests for 'auth.login' ---
  describe("MessagePattern('auth.login')", () => {
    const loginPayload = { username: 'testuser', password: 'password' };
    const userFromStrategy = { _id: 'user-id-123', username: 'testuser' };

    it('should return an access token on successful login', async () => {
      // Arrange
      const token = { accessToken: 'mock-jwt-token' };
      // 1. Mock the LocalStrategy to simulate successful authentication
      mockLocalStrategy.validate.mockResolvedValue(userFromStrategy);
      // 2. Mock the AuthService to return a token
      mockAuthService.login.mockResolvedValue(token);

      // Act
      const result = await firstValueFrom(
        client.send('auth.login', loginPayload),
      );

      // Assert
      expect(result).toEqual(token);
      // Verify that the strategy was called by the AuthGuard
      expect(mockLocalStrategy.validate).toHaveBeenCalledWith(
        loginPayload.username,
        loginPayload.password,
      );
      // Verify that the service was called with the user object from the strategy
      expect(mockAuthService.login).toHaveBeenCalledWith(userFromStrategy);
    });

    it('should throw an RpcException on authentication failure', async () => {
      // Arrange
      const authError = new UnauthorizedException('Invalid credentials');
      // Mock the LocalStrategy to simulate a failed login
      mockLocalStrategy.validate.mockRejectedValue(authError);

      // Act & Assert
      // The AuthGuard catches the UnauthorizedException and converts it to an RpcException
      await expect(
        firstValueFrom(client.send('auth.login', loginPayload)),
      ).rejects.toThrow(RpcException);

      // Ensure the login service was never called
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  // --- Tests for 'auth.token.validate' ---
  describe("MessagePattern('auth.token.validate')", () => {
    const tokenPayload = { jwt: 'valid-jwt-token' };
    const userPayloadFromStrategy = {
      sub: 'user-id-123',
      username: 'testuser',
    };

    it('should return the user payload if the token is valid', async () => {
      // Arrange: Mock the JwtStrategy to simulate a valid token
      mockJwtStrategy.validate.mockResolvedValue(userPayloadFromStrategy);

      // Act
      const result = await firstValueFrom(
        client.send('auth.token.validate', tokenPayload),
      );

      // Assert
      // The controller should simply return the payload from the strategy
      expect(result).toEqual(userPayloadFromStrategy);
      expect(mockJwtStrategy.validate).toHaveBeenCalled();
    });

    it('should throw an RpcException if the token is invalid', async () => {
      // Arrange: Mock the JwtStrategy to simulate an invalid token
      const authError = new UnauthorizedException('Token expired');
      mockJwtStrategy.validate.mockRejectedValue(authError);

      // Act & Assert
      await expect(
        firstValueFrom(client.send('auth.token.validate', tokenPayload)),
      ).rejects.toThrow(RpcException);
    });
  });
});
