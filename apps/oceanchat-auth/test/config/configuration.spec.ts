import {
  databaseConfiguration,
  jwtConfiguration,
  redisConfiguration,
} from '../../src/config/configuration';

describe('Test Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test to ensure isolation
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original process.env after all tests
    process.env = originalEnv;
  });

  describe('databaseConfiguration', () => {
    it('should return values from environment variables', () => {
      process.env.DATABASE_URI = 'env_uri';
      process.env.DATABASE_NAME = 'env_name';
      process.env.DATABASE_FULL_DOCUMENT = 'env_full_doc';

      const config = databaseConfiguration();
      expect(config).toEqual({
        uri: 'env_uri',
        name: 'env_name',
        fullDocument: 'env_full_doc',
      });
    });

    it('should return default values if environment variables are not set', () => {
      const config = databaseConfiguration();
      expect(config).toEqual({
        uri: 'mongodb://localhost:27017',
        name: 'oceanchat_development',
        fullDocument: 'updateLookup',
      });
    });
  });

  describe('redisConfiguration', () => {
    it('should return values from environment variables', () => {
      process.env.REDIS_HOST = 'env_host';
      process.env.REDIS_PORT = '1234';
      process.env.REDIS_DB = '15';

      const config = redisConfiguration();
      expect(config).toEqual({ host: 'env_host', port: 1234, db: 15 });
    });

    it('should return default values and parse port to number', () => {
      const config = redisConfiguration();
      expect(config).toEqual({ host: '127.0.0.1', port: 6379, db: 2 });
    });
  });

  describe('jwtConfiguration', () => {
    it('should return values from environment variables', () => {
      process.env.JWT_ACCESS_SECRET = 'my-access-secret';
      process.env.JWT_ACCESS_EXPIRES_IN = '1h';
      process.env.JWT_REFRESH_SECRET = 'my-refresh-secret';
      process.env.JWT_REFRESH_EXPIRES_IN = '14d';

      const config = jwtConfiguration();
      expect(config).toEqual({
        accessSecret: 'my-access-secret',
        accessExpiresIn: '1h',
        refreshSecret: 'my-refresh-secret',
        refreshExpiresIn: '14d',
      });
    });

    it('should return default values for expiry times if environment variables are not set', () => {
      const config = jwtConfiguration();
      expect(config).toEqual({
        accessSecret: undefined,
        accessExpiresIn: '15Mins',
        refreshSecret: undefined,
        refreshExpiresIn: '7Days',
      });
    });
  });
});
