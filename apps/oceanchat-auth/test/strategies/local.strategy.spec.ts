import { Test, TestingModule } from '@nestjs/testing';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider } from '@ocean.chat/models';

import { LocalStrategy } from '../../src/strategies/local.strategy';
import { UsersService } from '../../src/users/users.service';

describe('Test LocalStrategy', () => {
  let strategy: LocalStrategy;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let usersService: UsersService;

  const mockUsersService = {
    findOneByUsernameAndProvider: jest.fn(),
    verifyPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: I18nService,
          useValue: { translate: jest.fn((key: string) => key) },
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    usersService = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const username = 'testuser';
    const password = 'testpassword';
    const userWithPassword = {
      _id: 'userId123',
      username,
      providers: [
        {
          passwordHash: 'hashedPassword',
        },
      ],
    };

    it('should return user data for valid credentials', async () => {
      mockUsersService.findOneByUsernameAndProvider.mockResolvedValue(
        userWithPassword,
      );
      mockUsersService.verifyPassword.mockResolvedValue(true);

      const result = await strategy.validate(username, password);
      expect(
        mockUsersService.findOneByUsernameAndProvider,
      ).toHaveBeenCalledWith(username, AuthProvider.LOCAL);

      expect(mockUsersService.verifyPassword).toHaveBeenCalledWith(
        password,
        userWithPassword.providers[0].passwordHash,
      );
      expect(result).toEqual({ _id: userWithPassword._id, username });
    });

    it('should throw BaseRpcException for invalid username', async () => {
      mockUsersService.findOneByUsernameAndProvider.mockResolvedValue(null);

      await expect(strategy.validate(username, password)).rejects.toThrow(
        new BaseRpcException('User_not_found', ErrorCodes.INVALID_CREDENTIALS),
      );
      expect(
        mockUsersService.findOneByUsernameAndProvider,
      ).toHaveBeenCalledWith(username, AuthProvider.LOCAL);
      expect(mockUsersService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw BaseRpcException for invalid password', async () => {
      mockUsersService.findOneByUsernameAndProvider.mockResolvedValue(
        userWithPassword,
      );
      mockUsersService.verifyPassword.mockResolvedValue(false);

      await expect(strategy.validate(username, password)).rejects.toThrow(
        new BaseRpcException(
          'INVALID_CREDENTIALS',
          ErrorCodes.INVALID_CREDENTIALS,
        ),
      );
      expect(
        mockUsersService.findOneByUsernameAndProvider,
      ).toHaveBeenCalledWith(username, AuthProvider.LOCAL);
      expect(mockUsersService.verifyPassword).toHaveBeenCalledWith(
        password,
        userWithPassword.providers[0].passwordHash,
      );
    });
  });
});
