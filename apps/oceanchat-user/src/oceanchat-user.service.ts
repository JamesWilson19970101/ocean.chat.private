import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, User, UserRepository } from '@ocean.chat/models';
import { SettingsService } from '@ocean.chat/settings';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CreateUserDto } from './dto/create-user.dto';
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

  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    const { username, password } = createUserDto;

    try {
      // Perform dynamic validation using settings
      await this.validateCreateUserDto(username, password);

      // Hash the password before saving
      const passwordHash = await this.passwordService.hash(password);
      // Create a new user entity
      // I added an index to username, so if the username is the same, the creation will fail.
      const newUser = await this.userRepository.create({
        username,
        name: username, // Default name to username
        providers: [
          { provider: AuthProvider.LOCAL, providerId: username, passwordHash },
        ],
      });

      // Destructure to exclude the 'providers' array from the returned user object for security reasons.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { providers, ...userObject } = newUser.toObject();
      return userObject as Partial<User>;
    } catch (error) {
      // Handle MongoDB duplicate key error (code 11000)
      // This is a more robust way to handle race conditions during user creation
      // across multiple service instances.
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
      // If it's a business exception I threw ourselves, re-throw it.
      if (error instanceof BaseRpcException) {
        throw error;
      }
      // For any other unexpected error, wrap it in a standard application exception.
      // This ensures that I don't leak implementation details and that the boundary
      // logger has a consistent error object to work with.
      const errorMessage = this.i18nService.translate('USER_CREATION_ERROR');
      throw new BaseRpcException(
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.CREATION_ERROR,

        {
          cause: error,
        },
      );
    }
  }

  /**
   * Validates the CreateUserDto against dynamic settings.
   * @param username The username to validate.
   * @param password The password to validate.
   * @throws BusinessException if any validation rule is violated.
   */
  private async validateCreateUserDto(username: string, password: string) {
    // Fetch all validation settings in parallel for efficiency
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

    // Username validation
    // Add type checks for robustness in case a setting is missing or has the wrong type.
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

    // Password validation
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

    // Using a common regex for special characters
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

  /**
   * Find a user by their username and authentication provider.
   * @param username username to search for
   * @param provider authentication provider (e.g., LOCAL)
   * @returns user object with passwordHash included, or null if not found
   * @throws InternalServerErrorException for unexpected errors
   */
  async findOneByUsernameAndProvider(
    username: string,
    provider: AuthProvider,
  ): Promise<User | null> {
    return this.userRepository.findOneByUsernameAndProvider(username, provider);
  }

  /**
   * Find a user by their ID.
   * @param id The user's ID.
   * @returns The user object, or null if not found.
   */
  findOneById(id: string): Promise<Partial<User> | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Validates a user's password.
   * This method encapsulates the logic of finding a user and verifying their password,
   * preventing the password hash from leaving the service boundary.
   * @param username The user's username.
   * @param password The plaintext password to verify.
   * @returns The user object (without sensitive data) if validation is successful, otherwise null.
   */
  async validatePassword(
    username: string,
    password: string,
  ): Promise<Partial<User> | null> {
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
    return isValid ? userWithPassword : null;
  }

  /**
   * Adds a device to the user's device list or updates the last login time if it already exists.
   * @param userId The user's ID.
   * @param deviceId The device ID.
   */
  async addDevice(userId: string, deviceId: string): Promise<void> {
    const now = new Date();

    // Use aggregation pipeline to atomically update or push the device
    await this.userRepository.updateOne({ _id: userId }, [
      {
        $set: {
          devices: {
            $cond: [
              // Check if deviceId exists in the devices array
              { $in: [deviceId, { $ifNull: ['$devices.deviceId', []] }] },
              // If exists: map and update thee specific element
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
              // If not exists, cancat new device to array
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
