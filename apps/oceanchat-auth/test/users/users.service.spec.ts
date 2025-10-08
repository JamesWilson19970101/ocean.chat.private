import { Test, TestingModule } from '@nestjs/testing';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, User, UserRepository } from '@ocean.chat/models';
import { SettingsService } from '@ocean.chat/settings';
import { PinoLogger } from 'nestjs-pino';

import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { PasswordService } from '../../src/users/password.service';
import { UsersService } from '../../src/users/users.service';

describe('Test UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let settingsService: jest.Mocked<SettingsService>;
  let logger: jest.Mocked<PinoLogger>;

  const mockUser: Partial<User> = {
    _id: 'some-id',
    username: 'testuser',
    name: 'testuser',
    providers: [
      {
        provider: AuthProvider.LOCAL,
        providerId: 'testuser',
        passwordHash: 'hashed-password',
      },
    ],
    toObject: () => mockUser as User,
  };

  const createUserDto: CreateUserDto = {
    username: 'testuser',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneByUsernameAndProvider: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: I18nService,
          useValue: { translate: jest.fn((key: string) => key) },
        },
        {
          provide: 'PinoLogger:ocean.chat.auth.users.service',
          useValue: { error: jest.fn() },
        },
        {
          provide: UserRepository,
          useValue: userRepository,
        },
        {
          provide: PasswordService,
          useValue: { hash: jest.fn(), verify: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: { getSettingValue: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(UserRepository);
    passwordService = module.get(PasswordService);
    settingsService = module.get(SettingsService);
    logger = module.get('PinoLogger:ocean.chat.auth.users.service');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Test create of UsersService', () => {
    it('should create a new user successfully', async () => {
      const defaultSettings = {
        Accounts_Username_MinLength: 3,
        Accounts_Username_MaxLength: 30,
        Accounts_Username_Regex: '^[a-zA-Z0-9_]+$',
        Accounts_Password_MinLength: 8,
        Accounts_Password_RequireDigit: true,
        Accounts_Password_RequireLowercase: true,
        Accounts_Password_RequireUppercase: true,
        Accounts_Password_RequireSpecialChar: true,
      };
      jest
        .spyOn(settingsService, 'getSettingValue')
        // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
        .mockImplementation(async (key: string) => defaultSettings[key]);

      const findOneSpy = jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(null);
      const passwordServiceSpy = jest
        .spyOn(passwordService, 'hash')
        .mockResolvedValue('hashed-password');
      const createSpy = jest
        .spyOn(userRepository, 'create')
        .mockResolvedValue(mockUser as any);

      const result = await service.create(createUserDto);

      expect(findOneSpy).toHaveBeenCalledWith({
        username: createUserDto.username,
        'providers.provider': AuthProvider.LOCAL,
      });
      expect(passwordServiceSpy).toHaveBeenCalledWith(createUserDto.password);
      expect(createSpy).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw an exception if username already exists', async () => {
      // Arrange
      const defaultSettings = {
        Accounts_Username_MinLength: 3,
        Accounts_Username_MaxLength: 30,
        Accounts_Username_Regex: '^[a-zA-Z0-9_]+$',
        Accounts_Password_MinLength: 8,
        Accounts_Password_RequireDigit: true,
        Accounts_Password_RequireLowercase: true,
        Accounts_Password_RequireUppercase: true,
        Accounts_Password_RequireSpecialChar: true,
      };
      jest
        .spyOn(settingsService, 'getSettingValue')
        // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
        .mockImplementation(async (key: string) => defaultSettings[key]);

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BaseRpcException(
          'USERNAME_ALREADY_EXISTS',
          ErrorCodes.USERNAME_ALREADY_EXISTS,
        ),
      );
    });

    it('should throw an unexpected error if user creation fails', async () => {
      const defaultSettings = {
        Accounts_Username_MinLength: 3,
        Accounts_Username_MaxLength: 30,
        Accounts_Username_Regex: '^[a-zA-Z0-9_]+$',
        Accounts_Password_MinLength: 8,
        Accounts_Password_RequireDigit: true,
        Accounts_Password_RequireLowercase: true,
        Accounts_Password_RequireUppercase: true,
        Accounts_Password_RequireSpecialChar: true,
      };
      jest
        .spyOn(settingsService, 'getSettingValue')
        // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
        .mockImplementation(async (key: string) => defaultSettings[key]);
      // --- END: ADD THIS MOCK ---

      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordService, 'hash').mockResolvedValue('hashed-password');
      const dbError = new Error('Database connection lost');
      jest.spyOn(userRepository, 'create').mockRejectedValue(dbError);
      const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        new BaseRpcException(
          'USER_CREATION_FAILED',
          ErrorCodes.UNEXPECTED_ERROR,
        ),
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        { err: dbError },
        'USER_CREATION_FAILED',
      );
    });

    describe('Test validation of UsersService', () => {
      const defaultSettings = {
        Accounts_Username_MinLength: 3,
        Accounts_Username_MaxLength: 30,
        Accounts_Username_Regex: '^[a-zA-Z0-9_]+$',
        Accounts_Password_MinLength: 8,
        Accounts_Password_RequireDigit: false,
        Accounts_Password_RequireLowercase: false,
        Accounts_Password_RequireUppercase: false,
        Accounts_Password_RequireSpecialChar: false,
      };

      it.each([
        ['USERNAME_TOO_SHORT', 'Accounts_Username_MinLength', 100, undefined],
        ['USERNAME_TOO_LONG', 'Accounts_Username_MaxLength', 2, undefined],
        [
          'USERNAME_INVALID_CHARACTERS',
          'Accounts_Username_Regex',
          '^[0-9]+$',
          undefined,
        ],
        ['PASSWORD_TOO_SHORT', 'Accounts_Password_MinLength', 100, undefined],
        [
          'PASSWORD_NO_DIGIT',
          'Accounts_Password_RequireDigit',
          true,
          'PasswordWithoutDigit!',
        ],
        [
          'PASSWORD_NO_LOWERCASE',
          'Accounts_Password_RequireLowercase',
          true,
          'PASSWORD123!',
        ],
        [
          'PASSWORD_NO_UPPERCASE',
          'Accounts_Password_RequireUppercase',
          true,
          'password123!',
        ],
        [
          'PASSWORD_NO_SPECIAL_CHAR',
          'Accounts_Password_RequireSpecialChar',
          true,
          'Password123',
        ],
      ])(
        'should throw %s error',
        async (expectedError, settingKey, settingValue, passwordOverride?) => {
          const testSettings = {
            ...defaultSettings,
            [settingKey]: settingValue,
          };

          jest
            .spyOn(settingsService, 'getSettingValue')
            // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
            .mockImplementation(async (key: string) => testSettings[key]);

          const dto = {
            ...createUserDto,
            password: passwordOverride || createUserDto.password,
          };

          // Act & Assert
          await expect(service.create(dto)).rejects.toThrow(
            new BaseRpcException(expectedError, ErrorCodes[expectedError]),
          );
        },
      );
    });
  });

  describe('Test findOneByUsernameAndProvider of UsersService', () => {
    it('should call repository method with correct parameters', async () => {
      const username = 'test';
      const provider = AuthProvider.LOCAL;
      const findOneByUsernameAndProviderSpy = jest
        .spyOn(userRepository, 'findOneByUsernameAndProvider')
        .mockResolvedValue(mockUser as any);

      const result = await service.findOneByUsernameAndProvider(
        username,
        provider,
      );

      expect(findOneByUsernameAndProviderSpy).toHaveBeenCalledWith(
        username,
        provider,
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('Test verifyPassword of UsersService', () => {
    it('should call passwordService.verify with correct parameters', async () => {
      const plain = 'plain-pass';
      const hash = 'hashed-pass';
      const verifySpy = jest
        .spyOn(passwordService, 'verify')
        .mockResolvedValue(true);

      const result = await service.verifyPassword(plain, hash);

      expect(verifySpy).toHaveBeenCalledWith(plain, hash);
      expect(result).toBe(true);
    });
  });
});
