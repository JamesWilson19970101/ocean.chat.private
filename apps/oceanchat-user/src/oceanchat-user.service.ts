import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isAppException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import {
  AuthProvider,
  PermissionRepository,
  UserRepository,
} from '@ocean.chat/models';
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
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async getUserGlobalRoles(userId: string): Promise<string[]> {
    try {
      const roles = await this.userRepository.findRolesByUserId(userId);
      return roles || [];
    } catch (error) {
      throw new InfrastructureException(
        this.i18nService.translate('FAILED_TO_FETCH_GLOBAL_ROLES'),
        ErrorCodes.UNEXPECTED_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        { cause: error },
      );
    }
  }

  async getRolesForPermission(permissionId: string): Promise<string[]> {
    try {
      return await this.permissionRepository.findRolesById(permissionId);
    } catch (error) {
      throw new InfrastructureException(
        this.i18nService.translate('FAILED_TO_FETCH_PERMISSION_ROLES'),
        ErrorCodes.UNEXPECTED_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        { cause: error },
      );
    }
  }

  async create(createUserDto: CreateUserDto) {
    const { username, password } = createUserDto;
    try {
      await this.validateCreateUserDto(username, password);
      const passwordHash = await this.passwordService.hash(password);
      const newUser = await this.userRepository.create({
        username,
        name: username,
        roles: ['user'],
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
        throw new DomainException(
          this.i18nService.translate('USERNAME_ALREADY_EXISTS'),
          ErrorCodes.USERNAME_ALREADY_EXISTS,
          HttpStatus.CONFLICT,
        );
      }
      if (isAppException(error)) {
        throw error;
      }
      const errorMessage = this.i18nService.translate('USER_CREATION_ERROR');
      throw new InfrastructureException(
        errorMessage,
        ErrorCodes.CREATION_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        {
          cause: error,
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
      throw new DomainException(
        this.i18nService.translate('USERNAME_TOO_SHORT', {
          minLength: usernameMinLength,
        }),
        ErrorCodes.USERNAME_TOO_SHORT,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      typeof usernameMaxLength !== 'number' ||
      username.length > usernameMaxLength
    ) {
      throw new DomainException(
        this.i18nService.translate('USERNAME_TOO_LONG', {
          maxLength: usernameMaxLength,
        }),
        ErrorCodes.USERNAME_TOO_LONG,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (typeof usernameRegexString !== 'string') {
      throw new DomainException(
        this.i18nService.translate(
          'USERNAME_VALIDATION_REGEX_NOT_CONFIGURED_SUCCESSFULLY',
        ),
        ErrorCodes.UNEXPECTED_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const usernameRegex = new RegExp(usernameRegexString);
    if (!usernameRegex.test(username)) {
      throw new DomainException(
        this.i18nService.translate('USERNAME_INVALID_CHARACTERS'),
        ErrorCodes.USERNAME_INVALID_CHARACTERS,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      typeof passwordMinLength !== 'number' ||
      password.length < passwordMinLength
    ) {
      throw new DomainException(
        this.i18nService.translate('PASSWORD_TOO_SHORT'),
        ErrorCodes.PASSWORD_TOO_SHORT,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (passwordRequireDigit && !/\d/.test(password)) {
      throw new DomainException(
        this.i18nService.translate('PASSWORD_NO_DIGIT'),
        ErrorCodes.PASSWORD_NO_DIGIT,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (passwordRequireLowercase && !/[a-z]/.test(password)) {
      throw new DomainException(
        this.i18nService.translate('PASSWORD_NO_LOWERCASE'),
        ErrorCodes.PASSWORD_NO_LOWERCASE,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (passwordRequireUppercase && !/[A-Z]/.test(password)) {
      throw new DomainException(
        this.i18nService.translate('PASSWORD_NO_UPPERCASE'),
        ErrorCodes.PASSWORD_NO_UPPERCASE,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      passwordRequireSpecialChar &&
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      throw new DomainException(
        this.i18nService.translate('PASSWORD_NO_SPECIAL_CHAR'),
        ErrorCodes.PASSWORD_NO_SPECIAL_CHAR,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findOneByUsernameAndProvider(username: string, provider: AuthProvider) {
    return this.userRepository.findOneByUsernameAndProvider(username, provider);
  }

  findOneById(id: string) {
    return this.userRepository.findById(id);
  }

  findManyByIds(ids: string[]) {
    return this.userRepository.findByIds(ids);
  }

  async findAllUsernames(): Promise<{ _id: string; username: string }[]> {
    try {
      const users = await this.userRepository.find({}, { username: 1 });
      return (users || [])
        .filter((user) => Boolean(user.username))
        .map((user) => ({
          _id: String(user._id),
          username: user.username,
        }));
    } catch (error) {
      throw new InfrastructureException(
        this.i18nService.translate('UNEXPECTED_ERROR', {
          defaultValue: 'Failed to fetch usernames',
        }),
        ErrorCodes.UNEXPECTED_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        false,
        { cause: error },
      );
    }
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
    await this.userRepository.updateOne({ _id: userId }, [
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
    ]);
  }
}
