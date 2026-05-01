/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatAuthService } from '../src/oceanchat-auth.service';
import { RedisService } from '@ocean.chat/redis';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import {
  BoundedPublisherService,
  NatsJetStreamProvisionerService,
} from '@ocean.chat/nats-jetstream-provisioner';
import { PinoLogger } from 'nestjs-pino';
import { UsersService } from '../src/users/users.service';
import { ErrorCodes } from '@ocean.chat/common-exceptions';
import { AuthKeyUtil } from '@ocean.chat/cores';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Auth Integrity E2E Test Suite
 *
 * This suite verifies the robustness of the authentication lifecycle under
 * concurrent stress and security threats (replay attacks).
 *
 * Scenarios:
 * 1. Concurrent Refresh: Ensures Redis locks prevent double rotation.
 * 2. Replay Attack: Confirms "Family Revocation" wipes all sessions on reuse of old tokens.
 * 3. Data Corruption: Validates graceful handling of malformed session data.
 *
 * Rules:
 * - Real Redis: No mocks for the storage layer to catch race conditions.
 * - Promise.all: Explicitly triggers parallel execution.
 */
describe('Auth Integrity (Distributed Concurrency & Security)', () => {
  let service: OceanchatAuthService;
  let redisClient: Redis;
  let redisService: RedisService;
  let jwtService: JwtService;

  const TEST_REDIS_DB = 15;
  const mockUserId = 'user-' + uuidv4();
  const mockDeviceId = 'device-web';
  const mockUsername = 'concurrency_tester';

  beforeAll(async () => {
    // Setup real Redis connection for the test environment.
    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      db: TEST_REDIS_DB,
    });

    const localJwtService = new JwtService({ secret: 'test-signing-key' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OceanchatAuthService,
        {
          provide: RedisService,
          useValue: {
            setnx: (key: string, val: string, ttl: number) =>
              redisClient.set(key, val, 'EX', ttl, 'NX'),
            hget: (key: string, field: string) => redisClient.hget(key, field),
            hset: (key: string, field: string, val: string) =>
              redisClient.hset(key, field, val),
            hdel: (key: string, field: string) => redisClient.hdel(key, field),
            hgetall: (key: string) => redisClient.hgetall(key),
            del: (key: string) => redisClient.del(key),
            getClient: () => redisClient,
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockImplementation(async (token) => {
              const decoded = localJwtService.decode(token);
              if (!decoded) throw new Error('Invalid token');
              return decoded;
            }),
            signAsync: jest.fn().mockImplementation(async (payload) => localJwtService.sign(payload)),
            decode: jest.fn().mockImplementation((token) => localJwtService.decode(token)),
            sign: jest.fn().mockImplementation((payload) => localJwtService.sign(payload)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'jwt.refreshPublicKey') return 'test-signing-key';
              if (key === 'jwt.accessPrivateKey') return 'test-signing-key';
              if (key === 'jwt.refreshPrivateKey') return 'test-signing-key';
              if (key === 'jwt.accessExpiresIn') return '15m';
              if (key === 'jwt.refreshExpiresIn') return '7d';
              return null;
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOneById: jest
              .fn()
              .mockResolvedValue({ _id: mockUserId, username: mockUsername }),
          },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        {
          provide: BoundedPublisherService,
          useValue: { publishSafe: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: NatsJetStreamProvisionerService,
          useValue: {},
        },
        {
          provide: 'PinoLogger:oceanchat.auth.service',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OceanchatAuthService>(OceanchatAuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Explicitly clean Redis before each test case.
    await redisClient.flushdb();
    jest.clearAllMocks();
  });

  /**
   * Helper: Manually insert a session into Redis to simulate a logged-in user.
   */
  async function seedSession(
    userId: string,
    deviceId: string,
    refreshJti: string,
  ) {
    const userKey = AuthKeyUtil.getUserKey(userId);
    const storage = {
      accessToken: 'at-token',
      refreshToken: 'rt-token',
      accessJti: 'at-jti',
      refreshJti: refreshJti,
      lastActive: Date.now(),
    };
    await redisClient.hset(userKey, deviceId, JSON.stringify(storage));
  }

  /**
   * Test: Concurrent Refresh Collision
   * Condition: Multiple refresh requests arrive simultaneously for the same session.
   * Expectation: Distributed lock allows exactly ONE success; others fail with REUSED/REVOKED error.
   */
  it('should allow only ONE successful refresh when 5 requests hit concurrently', async () => {
    const refreshJti = uuidv4();
    // Generate a valid Refresh Token payload
    const rt = jwtService.sign({
      sub: mockUserId,
      deviceId: mockDeviceId,
      jti: refreshJti,
    });

    await seedSession(mockUserId, mockDeviceId, refreshJti);

    // Trigger 5 parallel promises
    const results = await Promise.allSettled([
      service.refreshToken(rt),
      service.refreshToken(rt),
      service.refreshToken(rt),
      service.refreshToken(rt),
      service.refreshToken(rt),
    ]);

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    if (successful.length !== 1) {
      console.error('Failed reasons:', failed.map(f => (f as PromiseRejectedResult).reason));
    }

    // Exactly one winner of the race
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(4);

    // Losers should receive the specific error code for reused tokens
    const firstFailure = (failed[0] as PromiseRejectedResult).reason;
    expect(firstFailure.errorCode).toBe(
      ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
    );
  });

  /**
   * Test: Replay Attack (Security Breach)
   * Condition: An attacker tries to use an old Refresh Token JTI that is no longer in Redis.
   * Expectation: Detect as replay, wipe ALL sessions for this user (Family Revocation).
   */
  it('should trigger family revocation (delete all sessions) if an old Refresh Token JTI is replayed', async () => {
    const userKey = AuthKeyUtil.getUserKey(mockUserId);

    // Seed two devices: Attack on 'desktop' should also logout 'mobile'
    const currentJti = uuidv4();
    const oldStolenJti = 'attacker-stolen-jti';

    await seedSession(mockUserId, 'desktop', currentJti);
    await seedSession(mockUserId, 'mobile', 'active-mobile-jti');

    // Replay with a JTI that doesn't match the current one in Redis
    const stolenRt = jwtService.sign({
      sub: mockUserId,
      deviceId: 'desktop',
      jti: oldStolenJti,
    });

    // Act
    await expect(service.refreshToken(stolenRt)).rejects.toThrow();

    // Assert: Check if all sessions for the user are gone
    const sessionCount = await redisClient.exists(userKey);
    expect(sessionCount).toBe(0);
  });

  /**
   * Test: Robustness to Corrupt Storage
   * Condition: Redis contains non-JSON data for a device field.
   * Expectation: Don't crash the entire service; catch error, log, and reject.
   */
  it('should handle malformed (non-JSON) session data in Redis gracefully', async () => {
    const refreshJti = uuidv4();
    const rt = jwtService.sign({
      sub: mockUserId,
      deviceId: mockDeviceId,
      jti: refreshJti,
    });
    const userKey = AuthKeyUtil.getUserKey(mockUserId);

    // Inject "poison" data
    await redisClient.hset(userKey, mockDeviceId, '--- THIS IS NOT JSON ---');

    // Act & Assert
    await expect(service.refreshToken(rt)).rejects.toThrow(
      expect.objectContaining({
        errorCode: ErrorCodes.REFRESH_TOKEN_REUSED_OR_REVOKED,
      }),
    );
  });
});
