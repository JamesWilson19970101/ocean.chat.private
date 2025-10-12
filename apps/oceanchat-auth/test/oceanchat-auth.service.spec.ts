import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { getLoggerToken } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';

import {
  getAccessSessionKey,
  getRefreshSessionKey,
} from '../src/common/utils/session.utils';
import { OceanchatAuthService } from '../src/oceanchat-auth.service';
import { UsersService } from '../src/users/users.service';

jest.mock('uuid');

describe('OceanchatAuthService', () => {
  let service: OceanchatAuthService;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let usersService: jest.Mocked<UsersService>;
  let i18nService: jest.Mocked<I18nService>;

  const mockUser: Pick<User, '_id' | 'username'> = {
    _id: 'user-id-123',
    username: 'testuser',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OceanchatAuthService,
        {
          provide: UsersService,
          useValue: {
            findOneById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn().mockResolvedValue('OK'),
            get: jest.fn(),
            del: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.accessExpiresIn') return '15m';
              if (key === 'jwt.refreshExpiresIn') return '7d';
              if (key === 'jwt.refreshSecret') return 'refresh-secret';
              return null;
            }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            translate: jest.fn((key) => key),
          },
        },
        {
          provide: getLoggerToken('oceanchat.auth.service'),
          useValue: {
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OceanchatAuthService>(OceanchatAuthService);
    jwtService = module.get(JwtService);
    redisService = module.get(RedisService);
    usersService = module.get(UsersService);
    i18nService = module.get(I18nService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should generate and store tokens, and return them with the user', async () => {
      const mockAccessToken = 'mock.access.token';
      const mockRefreshToken = 'mock.refresh.token';
      const mockAccessJti = 'access-jti';
      const mockRefreshJti = 'refresh-jti';

      (uuidv4 as jest.Mock)
        .mockReturnValueOnce(mockAccessJti)
        .mockReturnValueOnce(mockRefreshJti);

      // Arrange
      jwtService.signAsync
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      // Act
      const result = await service.login(mockUser);

      // Assert
      // 1. Correct tokens are returned
      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        user: mockUser,
      });

      // 2. JWT service was called correctly to sign tokens
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          username: mockUser.username,
          sub: mockUser._id,
          jti: mockAccessJti,
        },
        { expiresIn: '15m' },
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: mockUser._id, jti: mockRefreshJti },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );

      // 3. Sessions are stored in Redis
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.set).toHaveBeenCalledWith(
        getAccessSessionKey(mockAccessJti),
        mockUser._id,
        900, // 15m in seconds
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.set).toHaveBeenCalledWith(
        getRefreshSessionKey(mockRefreshJti),
        mockUser._id,
        604800, // 7d in seconds
      );
    });
  });

  describe('refreshToken', () => {
    const oldRefreshToken = 'old.refresh.token';
    const payload = { sub: mockUser._id, jti: 'refresh-jti' };
    const newAccessToken = 'new.access.token';
    const newRefreshToken = 'new.refresh.token';

    beforeEach(() => {
      // Reset mocks before each test in this describe block
      jest.clearAllMocks();
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce('new-access-jti')
        .mockReturnValueOnce('new-refresh-jti');
      jwtService.signAsync
        .mockResolvedValueOnce(newAccessToken)
        .mockResolvedValueOnce(newRefreshToken);
    });

    it('should issue new tokens for a valid refresh token', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(payload);
      redisService.get.mockResolvedValue(mockUser._id); // Session exists
      usersService.findOneById.mockResolvedValue(mockUser as User);

      // Act
      const result = await service.refreshToken(oldRefreshToken);

      // Assert
      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(oldRefreshToken, {
        secret: 'refresh-secret',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.get).toHaveBeenCalledWith(
        getRefreshSessionKey(payload.jti),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalledWith(
        getRefreshSessionKey(payload.jti),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersService.findOneById).toHaveBeenCalledWith(payload.sub);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2); // For new AT and RT
    });

    it('should throw Unauthorized if refresh token is invalid', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        new BaseRpcException('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(i18nService.translate).toHaveBeenCalledWith('UNAUTHORIZED');
    });

    it('should throw Unauthorized if session does not exist in Redis', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(payload);
      redisService.get.mockResolvedValue(null); // Session does not exist

      // Act & Assert
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        new BaseRpcException('UNAUTHORIZED', ErrorCodes.UNAUTHORIZED),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should throw Unauthorized if user is not found', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(payload);
      redisService.get.mockResolvedValue(mockUser._id);
      usersService.findOneById.mockResolvedValue(null); // User not found

      // Act & Assert
      await expect(service.refreshToken(oldRefreshToken)).rejects.toThrow(
        new BaseRpcException('User_not_found', ErrorCodes.UNAUTHORIZED),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.del).toHaveBeenCalledWith(
        getRefreshSessionKey(payload.jti),
      ); // The old session should still be deleted
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(i18nService.translate).toHaveBeenCalledWith('User_not_found');
    });
  });

  describe('validateToken', () => {
    it('should return the payload for a valid token', async () => {
      const mockToken = 'valid.jwt.token';
      const mockPayload = { sub: mockUser._id, username: mockUser.username };

      // Arrange
      const verifyAsyncSpy = jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(mockPayload);

      // Act
      const result = await service.validateToken(mockToken);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(verifyAsyncSpy).toHaveBeenCalledWith(mockToken);
    });

    it('should return null for an invalid or expired token', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.validateToken('invalid.token')).resolves.toBeNull();
    });
  });
});
