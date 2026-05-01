/* eslint-disable */
import { OceanchatUserService } from '../src/oceanchat-user.service';
import { I18nService } from '@ocean.chat/i18n';
import { PinoLogger } from 'nestjs-pino';
import { UserRepository } from '@ocean.chat/models';
import { PasswordService } from '../src/password.service';
import { SettingsService } from '@ocean.chat/settings';
import { ErrorCodes } from '@ocean.chat/common-exceptions';

/**
 * @file OceanchatUserService (Zero-DI Unit Test)
 * 
 * This test suite validates the core business logic of the user service,
 * specifically the complex validation rules for user registration.
 * 
 * Rules:
 * 1. Zero-DI: Directly instantiate the class to bypass NestJS container overhead.
 * 2. High Speed: Focus on pure logic (Input -> Output).
 * 3. English: All descriptions and comments are in English.
 */
describe('OceanchatUserService (Zero-DI Unit Test)', () => {
  let service: OceanchatUserService;
  let mockI18n: jest.Mocked<I18nService>;
  let mockLogger: jest.Mocked<PinoLogger>;
  let mockRepo: jest.Mocked<UserRepository>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockSettings: jest.Mocked<SettingsService>;
  let mockUserModel: any;
  let mockPermissionModel: any;

  beforeEach(() => {
    // Mock I18nService: Returns keys or simple string replacements for verification.
    mockI18n = {
      translate: jest.fn().mockImplementation((key, args) => {
        if (args) {
          let str = key;
          for (const [k, v] of Object.entries(args)) {
            str = str.replace(`{${k}}`, String(v));
          }
          return str;
        }
        return key;
      }),
    } as any;

    // Mock PinoLogger: Silent logger to keep test console clean.
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      setContext: jest.fn(),
    } as any;

    mockRepo = {} as any;
    mockPasswordService = {} as any;
    
    // Mock SettingsService: Controls validation policies for testing.
    mockSettings = {
      getSettingValue: jest.fn(),
    } as any;

    mockUserModel = {} as any;
    mockPermissionModel = {} as any;

    // Direct instantiation: 10x faster than NestJS Test container.
    service = new OceanchatUserService(
      mockI18n,
      mockLogger,
      mockRepo,
      mockPasswordService,
      mockSettings,
      mockUserModel,
      mockPermissionModel,
    );
  });

  describe('validateCreateUserDto (Core Business Rules)', () => {
    // Default validation settings for consistent test baseline.
    const defaultSettings: Record<string, any> = {
      Accounts_Username_MinLength: 3,
      Accounts_Username_MaxLength: 20,
      Accounts_Username_Regex: '^[a-zA-Z0-9_.]+$',
      Accounts_Password_MinLength: 8,
      Accounts_Password_RequireDigit: true,
      Accounts_Password_RequireLowercase: true,
      Accounts_Password_RequireUppercase: true,
      Accounts_Password_RequireSpecialChar: true,
    };

    beforeEach(() => {
      mockSettings.getSettingValue.mockImplementation((key) => defaultSettings[key]);
    });

    describe('Username Policy Validation', () => {
      /**
       * Scenario: Reject invalid usernames based on length and character set.
       * Purpose: Ensure registration prevents poor data quality and potential injection characters.
       */
      test.each([
        ['ab', ErrorCodes.USERNAME_TOO_SHORT],                // Fails: Length 2 < 3
        ['a'.repeat(21), ErrorCodes.USERNAME_TOO_LONG],       // Fails: Length 21 > 20
        ['user!name', ErrorCodes.USERNAME_INVALID_CHARACTERS], // Fails: Forbidden '!'
        ['user name', ErrorCodes.USERNAME_INVALID_CHARACTERS], // Fails: Forbidden space
        ['用户名称', ErrorCodes.USERNAME_INVALID_CHARACTERS],      // Fails: Non-ASCII (Default policy), length is 4 to bypass length check
      ])('should reject username "%s" with ErrorCode %s', async (username, expectedErrorCode) => {
        await expect(service.validateCreateUserDto(username, 'StrongPass123!'))
          .rejects.toThrow(expect.objectContaining({ errorCode: expectedErrorCode }));
      });

      /**
       * Scenario: Accept valid alphanumeric usernames.
       * Purpose: Confirm support for standard naming conventions.
       */
      it('should accept a valid alphanumeric username (e.g., ocean_chat.2024)', async () => {
        await expect(service.validateCreateUserDto('ocean_chat.2024', 'StrongPass123!'))
          .resolves.not.toThrow();
      });
    });

    describe('Password Complexity Validation', () => {
      /**
       * Scenario: Reject weak passwords failing security criteria.
       * Purpose: Enforce account security and prevent trivial password guessing.
       */
      test.each([
        ['Short1!', ErrorCodes.PASSWORD_TOO_SHORT],         // Fails: Length 7 < 8
        ['NoDigits!', ErrorCodes.PASSWORD_NO_DIGIT],         // Fails: Missing '0-9'
        ['no_uppercase1!', ErrorCodes.PASSWORD_NO_UPPERCASE], // Fails: Missing 'A-Z'
        ['NO_LOWERCASE1!', ErrorCodes.PASSWORD_NO_LOWERCASE], // Fails: Missing 'a-z'
        ['NoSpecialChar1', ErrorCodes.PASSWORD_NO_SPECIAL_CHAR], // Fails: Missing '@#!...'
      ])('should reject weak password "%s" with ErrorCode %s', async (password, expectedErrorCode) => {
        await expect(service.validateCreateUserDto('valid_user', password))
          .rejects.toThrow(expect.objectContaining({ errorCode: expectedErrorCode }));
      });

      /**
       * Scenario: Accept passwords meeting all criteria.
       * Purpose: Validate the happy path for secure registration.
       */
      it('should accept a password meeting all security requirements', async () => {
        await expect(service.validateCreateUserDto('valid_user', 'Complex@Password888'))
          .resolves.not.toThrow();
      });
    });
  });
});
