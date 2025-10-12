import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { LoggerModule } from 'nestjs-pino';

import { REDIS_CLIENT, RedisClient, RedisModule, RedisService } from '../src';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RedisService (Integration)', () => {
  let app: INestApplication;
  let service: RedisService;
  let client: RedisClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({ pinoHttp: { enabled: false } }),
        I18nModule.forRoot(),
        RedisModule.register({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          db: parseInt(process.env.REDIS_DB_TEST || '15', 10), // Use dedicated test DB
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = app.get<RedisService>(RedisService);
    client = app.get<RedisClient>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await client.quit();
    await app.close();
  });

  // Clean the database before each test to ensure isolation
  beforeEach(async () => {
    await client.flushdb();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set and get', () => {
    it('should set and get a string value', async () => {
      await service.set('test-key', 'test-value');
      const value = await service.get<string>('test-key');
      expect(value).toBe('test-value');
    });

    it('should set and get a complex object', async () => {
      const user = { id: 1, name: 'John Doe', roles: ['admin'] };
      await service.set('user:1', user);
      const cachedUser = await service.get<{ id: number; name: string }>(
        'user:1',
      );
      expect(cachedUser).toEqual(user);
    });

    it('should return null for a non-existent key', async () => {
      const value = await service.get('non-existent-key');
      expect(value).toBeNull();
    });

    it('should set a value with a TTL and expire correctly', async () => {
      await service.set('ttl-key', 'temporary', 1); // 1 second TTL
      expect(await service.get('ttl-key')).toBe('temporary');
      await sleep(1100); // Wait for TTL to expire
      expect(await service.get('ttl-key')).toBeNull();
    });

    it('should handle non-JSON string when getting', async () => {
      // Use raw client to set a non-JSON value
      await client.set('raw-string', 'just-a-string');
      const value = await service.get<string>('raw-string');
      expect(value).toBe('just-a-string');
    });
  });

  describe('del', () => {
    it('should delete a single key', async () => {
      await service.set('key-to-delete', 'value');
      expect(await service.get('key-to-delete')).not.toBeNull();
      const deleteCount = await service.del('key-to-delete');
      expect(deleteCount).toBe(1);
      expect(await service.get('key-to-delete')).toBeNull();
    });

    it('should delete multiple keys', async () => {
      await service.set('key1', 'v1');
      await service.set('key2', 'v2');
      const deleteCount = await service.del(['key1', 'key2']);
      expect(deleteCount).toBe(2);
      expect(await service.get('key1')).toBeNull();
      expect(await service.get('key2')).toBeNull();
    });

    it('should return 0 if no keys are provided', async () => {
      expect(await service.del([])).toBe(0);
    });
  });

  describe('setnx', () => {
    it('should set a key if it does not exist', async () => {
      const result = await service.setnx('lock-key', 'locked', 10);
      expect(result).toBe('OK');
      expect(await client.get('lock-key')).toBe('locked');
    });

    it('should not set a key if it already exists', async () => {
      await service.setnx('lock-key', 'locked', 10);
      const result = await service.setnx('lock-key', 'new-lock', 10);
      expect(result).toBeNull();
      expect(await client.get('lock-key')).toBe('locked'); // Value remains unchanged
    });
  });

  describe('hset', () => {
    it('should set a field in a hash', async () => {
      const result = await service.hset('my-hash', 'field1', 'value1');
      expect(result).toBe(1); // 1 field was added
      expect(await client.hget('my-hash', 'field1')).toBe('value1');
    });
  });

  describe('mset', () => {
    it('should set multiple key-value pairs', async () => {
      const result = await service.mset(['k1', 'v1', 'k2', 'v2']);
      expect(result).toBe('OK');
      expect(await client.get('k1')).toBe('v1');
      expect(await client.get('k2')).toBe('v2');
    });
  });

  describe('expire', () => {
    it('should set an expiration on a key', async () => {
      await service.set('exp-key', 'some-value');
      const result = await service.expire('exp-key', 1);
      expect(result).toBe(1);
      await sleep(1100);
      expect(await client.get('exp-key')).toBeNull();
    });

    it('should return 0 if key does not exist', async () => {
      const result = await service.expire('non-existent-key', 10);
      expect(result).toBe(0);
    });
  });

  describe('getOrSet', () => {
    const fetcher = jest.fn();
    const key = 'get-or-set-key';
    const options = { ttl: 10 };

    beforeEach(() => {
      fetcher.mockClear();
    });

    it('should call fetcher on cache miss and cache the result', async () => {
      fetcher.mockResolvedValue('fetched-value');

      const result = await service.getOrSet(key, fetcher, options);

      expect(result).toBe('fetched-value');
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Verify it's cached
      const cachedValue = await service.get(key);
      expect(cachedValue).toBe('fetched-value');
    });

    it('should return cached value on cache hit and not call fetcher', async () => {
      await service.set(key, 'cached-value');
      fetcher.mockResolvedValue('new-fetched-value');

      const result = await service.getOrSet(key, fetcher, options);

      expect(result).toBe('cached-value');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should handle negative caching when fetcher returns null', async () => {
      fetcher.mockResolvedValue(null);
      const nullOptions = { ttl: 10, nullTtl: 2 };

      // First call, fetcher is called
      const result1 = await service.getOrSet(key, fetcher, nullOptions);
      expect(result1).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call, should hit negative cache, fetcher not called
      const result2 = await service.getOrSet(key, fetcher, nullOptions);
      expect(result2).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);

      // After nullTtl expires, fetcher should be called again
      await sleep(2100);
      const result3 = await service.getOrSet(key, fetcher, nullOptions);
      expect(result3).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should prevent cache stampede using a lock', async () => {
      // This simulates two concurrent requests for the same missing key
      const slowFetcher = jest.fn(async () => {
        await sleep(200); // Simulate slow data source
        return 'slow-fetched-value';
      });

      const promises = Promise.all([
        service.getOrSet(key, slowFetcher, {
          ttl: 10,
          lockTtl: 1,
          lockWaitTime: 50,
        }),
        service.getOrSet(key, slowFetcher, {
          ttl: 10,
          lockTtl: 1,
          lockWaitTime: 50,
        }),
      ]);

      const [result1, result2] = await promises;

      // Both should get the same result
      expect(result1).toBe('slow-fetched-value');
      expect(result2).toBe('slow-fetched-value');

      // But the fetcher should only have been called once
      expect(slowFetcher).toHaveBeenCalledTimes(1);
    });

    it('should apply TTL jitter', async () => {
      fetcher.mockResolvedValue('value-with-jitter');
      const jitterOptions = { ttl: 10, ttlJitter: 5 };

      await service.getOrSet(key, fetcher, jitterOptions);

      const ttl = await client.ttl(key);
      // TTL should be between 10 and 15 (10 + 5)
      expect(ttl).toBeGreaterThanOrEqual(10);
      expect(ttl).toBeLessThanOrEqual(15);
    });
  });

  describe('onModuleDestroy', () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    it('should call disconnect on the client', async () => {
      const localClient = {
        disconnect: jest.fn(() => {}),
      } as unknown as RedisClient;

      // Create a temporary service instance with a mocked client
      const mockI18nService: I18nService = {
        translate: (key: string) => String(key),
        getI18next: () => ({}) as typeof import('i18next'),
      };
      const tempService = new RedisService(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        console as any,
        localClient,
        mockI18nService,
      );

      tempService.onModuleDestroy();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(localClient.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
