import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { getLoggerToken } from 'nestjs-pino';

import { getAccessSessionKey } from '../../src/common/utils/session.utils';
import { JwtStrategy } from '../../src/strategies/jwt.strategy';
import { UsersService } from '../../src/users/users.service';

describe('Test JwtStrategy', () => {
  let strategy: JwtStrategy;
  let redisService: jest.Mocked<RedisService>;
  let i18nService: jest.Mocked<I18nService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: I18nService,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            translate: jest.fn((key) => key),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.accessSecret') {
                return 'secret';
              }
              return null;
            }),
          },
        },
        {
          provide: getLoggerToken('ocean.chat.auth.jwt.strategy'),
          useValue: {
            error: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {}, // Not used in validate method, can be an empty mock
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    redisService = module.get(RedisService);
    i18nService = module.get(I18nService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const payload = {
      username: 'testuser',
      sub: 'user-id-123',
      jti: 'jwt-id-abc',
      iat: Date.now(),
    };

    it('should return user data if session exists in Redis', async () => {
      // Arrange
      redisService.get.mockResolvedValue('user-id-123'); // Simulate session found

      // Act
      const result = await strategy.validate(payload);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(redisService.get).toHaveBeenCalledWith(
        getAccessSessionKey(payload.jti),
      );
      expect(result).toEqual({ sub: payload.sub, username: payload.username });
    });

    it('should throw an Unauthorized exception if session does not exist in Redis', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null); // Simulate session not found

      // Act & Assert
      await expect(strategy.validate(payload)).rejects.toThrow(
        new BaseRpcException('JWT_Revoked', ErrorCodes.UNAUTHORIZED),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(i18nService.translate).toHaveBeenCalledWith('JWT_Revoked');
    });
  });
});
