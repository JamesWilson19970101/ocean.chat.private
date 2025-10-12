import { validationSchema } from '../../src/config/validation';

describe('Config Validation Schema', () => {
  let validConfig: Record<string, any>;

  beforeEach(() => {
    validConfig = {
      DATABASE_URI: 'mongodb://localhost:27017',
      DATABASE_NAME: 'oceanchat_test',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      REDIS_DB: 15,
      JWT_ACCESS_SECRET: 'a-very-secret-and-long-key-for-testing',
      JWT_ACCESS_EXPIRES_IN: '15Mins',
      JWT_REFRESH_SECRET: 'another-very-secret-and-long-key-for-testing',
      JWT_REFRESH_EXPIRES_IN: '7Days',
    };
  });

  it('should validate a correct configuration', () => {
    const { error } = validationSchema.validate(validConfig);
    expect(error).toBeUndefined();
  });

  it('should return the validated value for a correct configuration', () => {
    const { value } = validationSchema.validate(validConfig);
    expect(value).toEqual(validConfig);
  });

  // Test for missing required fields
  test.each([
    ['DATABASE_URI', 'DATABASE_URI is required'],
    ['DATABASE_NAME', 'DATABASE_NAME is required'],
    ['REDIS_HOST', 'REDIS_HOST is required'],
    ['REDIS_PORT', 'REDIS_PORT is required'],
    ['REDIS_DB', 'REDIS_DB is required'],
    ['JWT_ACCESS_SECRET', 'JWT_ACCESS_SECRET is required'],
    ['JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET is required'],
  ])('should fail if %s is missing', (key, expectedMessage) => {
    delete validConfig[key];
    const { error } = validationSchema.validate(validConfig);
    expect(error).toBeDefined();
    expect(error?.details[0].message).toBe(expectedMessage);
  });

  // Test for empty string on required string fields
  test.each([
    ['DATABASE_URI', 'DATABASE_URI is required'],
    ['DATABASE_NAME', 'DATABASE_NAME is required'],
    ['REDIS_HOST', 'REDIS_HOST is required'],
    ['JWT_ACCESS_SECRET', 'JWT_ACCESS_SECRET is required'],
    ['JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET is required'],
  ])('should fail if %s is an empty string', (key, expectedMessage) => {
    validConfig[key] = '';
    const { error } = validationSchema.validate(validConfig);
    expect(error).toBeDefined();
    expect(error?.details[0].message).toBe(expectedMessage);
  });

  it('should fail if REDIS_PORT is not a number', () => {
    validConfig.REDIS_PORT = 'not-a-number';
    const { error } = validationSchema.validate(validConfig, {
      // Joi by default tries to convert, we need to check the base type
      convert: false,
    });
    expect(error).toBeDefined();
    expect(error?.details[0].message).toBe('REDIS_PORT must be a number');
  });

  it('should use default values for JWT expiry if not provided', () => {
    delete validConfig.JWT_ACCESS_EXPIRES_IN;
    delete validConfig.JWT_REFRESH_EXPIRES_IN;
    const { value } = validationSchema.validate(validConfig);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(value.JWT_ACCESS_EXPIRES_IN).toBe('15Mins'); // Default from validation.ts
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(value.JWT_REFRESH_EXPIRES_IN).toBe('7Days'); // Default from validation.ts
  });
});
