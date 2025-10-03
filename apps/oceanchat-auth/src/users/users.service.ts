import { Injectable } from '@nestjs/common';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, User } from '@ocean.chat/models';
import { UserRepository } from '@ocean.chat/models';
import { SettingsService } from '@ocean.chat/settings';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CreateUserDto } from './dto/create-user.dto';
import { PasswordService } from './password.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly i18nService: I18nService,
    @InjectPinoLogger('ocean.chat.auth.users.service')
    private readonly logger: PinoLogger,
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Create a new user with the provided details.
   * @param createUserDto data transfer object containing user creation info
   * @returns the created user object (partial)
   * @throws BusinessException if the username already exists
   * @throws InternalServerErrorException for other unexpected errors
   */
  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    // Destructure username and password from the DTO
    // DTO has validated this password and confirmPassword match, so here we can safely use username and password
    const { username, password } = createUserDto;

    try {
      // Perform dynamic validation using settings
      await this.validateCreateUserDto(username, password);

      // check if the username already exists
      const existingUser = await this.userRepository.findOne({
        username,
        'providers.provider': AuthProvider.LOCAL,
      });

      if (existingUser) {
        throw new BaseRpcException(
          this.i18nService.translate('USERNAME_ALREADY_EXISTS'),
          ErrorCodes.USERNAME_ALREADY_EXISTS,
        );
      }

      // Hash the password before saving
      const passwordHash = await this.passwordService.hash(password);
      // Create a new user entity
      const newUser = await this.userRepository.create({
        username,
        name: username, // Default name to username
        providers: [
          { provider: AuthProvider.LOCAL, providerId: username, passwordHash },
        ],
      });

      return newUser.toObject() as Partial<User>;
    } catch (error) {
      // If it's a business exception we threw ourselves, re-throw it.
      if (error instanceof BaseRpcException) {
        throw error;
      }
      // Otherwise, treat it as an internal server error.
      const errorMessage = this.i18nService.translate('USER_CREATION_FAILED');
      this.logger.error({ err: error }, errorMessage);
      throw new BaseRpcException(errorMessage, ErrorCodes.UNEXPECTED_ERROR);
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
  ): Promise<{ [key: string]: any; passwordHash: string } | null> {
    return this.userRepository.findOneByUsernameAndProvider(username, provider);
  }

  /**
   * Verify a plain text password against a hashed password.
   * @param plain password in plain text
   * @param hash hashed password from the database
   * @returns true if the password matches, false otherwise
   */
  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return this.passwordService.verify(plain, hash);
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
        this.i18nService.translate('USERNAME_TOO_SHORT', {}),
        ErrorCodes.USERNAME_TOO_SHORT,
      );
    }
    if (
      typeof usernameMaxLength !== 'number' ||
      username.length > usernameMaxLength
    ) {
      throw new BaseRpcException(
        this.i18nService.translate('USERNAME_TOO_LONG', {}),
        ErrorCodes.USERNAME_TOO_LONG,
      );
    }
    if (typeof usernameRegexString !== 'string') {
      throw new BaseRpcException(
        'Username validation regex is not configured.',
        ErrorCodes.UNEXPECTED_ERROR,
      );
    }
    const usernameRegex = new RegExp(usernameRegexString);
    if (!usernameRegex.test(username)) {
      throw new BaseRpcException(
        this.i18nService.translate('USERNAME_INVALID_CHARACTERS'),
        ErrorCodes.USERNAME_INVALID_CHARACTERS,
      );
    }

    // Password validation
    if (
      typeof passwordMinLength !== 'number' ||
      password.length < passwordMinLength
    ) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_TOO_SHORT', {}),
        ErrorCodes.PASSWORD_TOO_SHORT,
      );
    }

    if (passwordRequireDigit && !/\d/.test(password)) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_DIGIT'),
        ErrorCodes.PASSWORD_NO_DIGIT,
      );
    }

    if (passwordRequireLowercase && !/[a-z]/.test(password)) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_LOWERCASE'),
        ErrorCodes.PASSWORD_NO_LOWERCASE,
      );
    }

    if (passwordRequireUppercase && !/[A-Z]/.test(password)) {
      throw new BaseRpcException(
        this.i18nService.translate('PASSWORD_NO_UPPERCASE'),
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
        ErrorCodes.PASSWORD_NO_SPECIAL_CHAR,
      );
    }
  }
}
