import { validationSchema } from '../../src/config/validation';

describe('Config Validation Schema', () => {
  let validConfig: Record<string, any>;

  beforeEach(() => {
    validConfig = {
      DATABASE_URI: 'mongodb://localhost:27017/test',
      DATABASE_NAME: 'oceanchat_test',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      JWT_SECRET: 'a-very-secret-and-long-key-for-testing',
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
    ['JWT_SECRET', 'JWT_SECRET is required'],
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
    ['JWT_SECRET', 'JWT_SECRET is required'],
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
});
