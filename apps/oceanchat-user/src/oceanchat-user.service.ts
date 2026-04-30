import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, UserRepository } from '@ocean.chat/models';
import { SettingsService } from '@ocean.chat/settings';
import { CreateUserDto } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { PasswordService } from './password.service';

@Injectable()
export class OceanchatUserService {
  constructor(
    private readonly i18nService: I18nService,
    @InjectPinoLogger('ocean.chat.user.service')
    private readonly logger: PinoLogger,
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { username, password } = createUserDto;
    try {
      await this.validateCreateUserDto(username, password);
      const passwordHash = await this.passwordService.hash(password);
      const newUser = await this.userRepository.create({
        username,
        name: username,
        providers: [
          { provider: AuthProvider.LOCAL, providerId: username, passwordHash },
        ],
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { providers, ...userObject } = newUser;
      return userObject;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new BaseRpcException(
          this.i18nService.translate('USERNAME_ALREADY_EXISTS'),
          HttpStatus.CONFLICT,
          ErrorCodes.USERNAME_ALREADY_EXISTS,
        );
      }
      if (error instanceof BaseRpcException) {
        throw error;
      }
      const errorMessage = this.i18nService.translate('USER_CREATION_ERROR');
      throw new BaseRpcException(
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.CREATION_ERROR,
        {
          cause: error as any,
        },
      );
    }
  }

  async validateCreateUserDto(username: string, password: string) {
    const [
      usernameMinLength,
      usernameMaxLength,
      usernameRegexString,
      passwordMinLength,
      passwordRequireDigit,
      passwordRequireLowercase,
      passwordRequireUppercase,
      passwordRequireSpecialChar,
    ] = await Promise.all([
      this.settingsService.getSettingValue('Accounts_Username_MinLength'),
      this.settingsService.getSettingValue('Accounts_Username_MaxLength'),
      this.settingsService.getSettingValue('Accounts_Username_Regex'),
      this.settingsService.getSettingValue('Accounts_Password_MinLength'),
      this.settingsService.getSettingValue('Accounts_Password_RequireDigit'),
      this.settingsService.getSettingValue(
        'Accounts_Password_RequireLowercase',
      ),
      this.settingsService.getSettingValue(
        'Accounts_Password_RequireUppercase',
      ),
      this.settingsService.getSettingValue(
        'Accounts_Password_RequireSpecialChar',
      ),
    ]);

    if (
      typeof usernameMinLength !== 'number' ||
      username.length < usernameMinLength
    ) {
      throw new BaseRpcException(
        this.i18nService.translate('USERNAME_TOO_SHORT', {
          minLength: usernameMinLength,
        }),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.USERNAME_TOO_SHORT,
      );
    }
    if (
      typeof usernameMaxLength !== 'number' ||
      username.length > usernameMaxLength
    ) {
      throw new BaseRpcException(
        this.i18nService.translate('USERNAME_TOO_LONG', {
          maxLength: usernameMaxLength,
        }),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.USERNAME_TOO_LONG,
      );
    }
    if (typeof usernameRegexString !== 'string') {
      throw new BaseRpcException(
        this.i18nService.translate(
          'USERNAME_VALIDATION_REGEX_NOT_CONFIGURED_SUCCESSFULLY',
        ),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.UNEXPECTED_ERROR,
      );
    }
    const usernameRegex = new RegExp(usernameRegexString);
    if (!usernameRegex.test(username)) {
      throw new BaseRpcException(
        this.i18nService.translate('USERNAME_INVALID_CHARACTERS'),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.USERNAME_INVALID_CHARACTERS,
      );
    }

    if (
      typeof passwordMinLength !== 'number' ||
      password.length < passwordMinLength
    ) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_TOO_SHORT'),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.PASSWORD_TOO_SHORT,
      );
    }
    if (passwordRequireDigit && !/\d/.test(password)) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_DIGIT'),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.PASSWORD_NO_DIGIT,
      );
    }
    if (passwordRequireLowercase && !/[a-z]/.test(password)) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_LOWERCASE'),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.PASSWORD_NO_LOWERCASE,
      );
    }
    if (passwordRequireUppercase && !/[A-Z]/.test(password)) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_UPPERCASE'),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.PASSWORD_NO_UPPERCASE,
      );
    }
    if (
      passwordRequireSpecialChar &&
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_SPECIAL_CHAR'),
        HttpStatus.BAD_REQUEST,
        ErrorCodes.PASSWORD_NO_SPECIAL_CHAR,
      );
    }
  }

  async findOneByUsernameAndProvider(username: string, provider: AuthProvider) {
    return this.userRepository.findOneByUsernameAndProvider(username, provider);
  }

  findOneById(id: string) {
    return this.userRepository.findById(id);
  }

  async validatePassword(username: string, password: string) {
    const userWithPassword = await this.findOneByUsernameAndProvider(
      username,
      AuthProvider.LOCAL,
    );
    if (!userWithPassword?.providers?.[0]?.passwordHash) {
      return null;
    }
    const isValid = await this.passwordService.verify(
      password,
      userWithPassword.providers[0].passwordHash,
    );
    if (!isValid) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { providers, ...userObject } = userWithPassword;
    return userObject;
  }

  async addDevice(userId: string, deviceId: string, loginTime?: Date) {
    const now = loginTime || new Date();
    await this.userRepository.updateOne(
      { _id: userId } as unknown as import('mongoose').FilterQuery<
        import('@ocean.chat/models').User
      >,
      [
        {
          $set: {
            lastLogin: now,
            devices: {
              $cond: [
                { $in: [deviceId, { $ifNull: ['$devices.deviceId', []] }] },
                {
                  $map: {
                    input: '$devices',
                    as: 'd',
                    in: {
                      $cond: [
                        { $eq: ['$$d.deviceId', deviceId] },
                        { $mergeObjects: ['$$d', { lastLogin: now }] },
                        '$$d',
                      ],
                    },
                  },
                },
                {
                  $concatArrays: [
                    { $ifNull: ['$devices', []] },
                    [{ deviceId, lastLogin: now }],
                  ],
                },
              ],
            },
          },
        },
      ] as unknown as import('mongoose').UpdateQuery<
        import('@ocean.chat/models').User
      >,
    );
  }
}
