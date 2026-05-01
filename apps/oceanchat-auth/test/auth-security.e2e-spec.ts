/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatAuthService } from '../src/oceanchat-auth.service';
import { RedisService } from '@ocean.chat/redis';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BoundedPublisherService, NatsJetStreamProvisionerService } from '@ocean.chat/nats-jetstream-provisioner';
import { UsersService } from '../src/users/users.service';
import { AuthKeyUtil } from '@ocean.chat/cores';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Auth Security E2E Test Suite
 *
 * Focus: Advance Attack Neutralization (Replay & Session Hijacking).
 * This suite specifically tests the "Family Revocation" security mechanism.
 * If a Refresh Token is leaked and replayed after rotation, the system MUST
 * identify the anomaly (JTI mismatch) and terminate ALL sessions for that user.
 *
 * Rules:
 * - Security First: Verifies that account protection takes precedence over convenience.
 * - Real Infrastructure: Uses Redis to track session family deletion.
 */
describe('Auth Security (Family Revocation)', () => {
  let service: OceanchatAuthService;
  let redisClient: Redis;
  let jwtService: JwtService;

  const TEST_REDIS_DB = 15;
  const mockUserId = 'user-security-test';

  beforeAll(async () => {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      db: TEST_REDIS_DB,
    });

    const realJwtService = new JwtService({ secret: 'security-secret' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OceanchatAuthService,
        {
          provide: RedisService,
          useValue: {
            setnx: (key: string, val: string, ttl: number) =>
              redisClient.set(key, val, 'EX', ttl, 'NX'),
            hget: (key: string, field: string) => redisClient.hget(key, field),
            hgetall: (key: string) => redisClient.hgetall(key),
            del: (key: string) => redisClient.del(key),
            getClient: () => redisClient,
            expire: (key: string, ttl: number) => redisClient.expire(key, ttl),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockImplementation(async (token) => {
              const decoded = realJwtService.decode(token);
              if (!decoded) throw new Error('Invalid token');
              return decoded;
            }),
            signAsync: jest.fn().mockImplementation(async (payload) => realJwtService.sign(payload)),
            decode: jest.fn().mockImplementation((token) => realJwtService.decode(token)),
            sign: jest.fn().mockImplementation((payload) => realJwtService.sign(payload)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key.includes('PublicKey') || key.includes('PrivateKey') ? 'security-secret' : '15m',
          },
        },
        {
          provide: UsersService,
          useValue: { findOneById: jest.fn() },
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
          provide: 'PinoLogger:oceanchat.auth.service',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        { provide: NatsJetStreamProvisionerService, useValue: {} },
      ],
    }).compile();

    service = module.get<OceanchatAuthService>(OceanchatAuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    await redisClient.flushdb();
  });

  /**
   * Helper: Manually seed multiple sessions (Desktop, Mobile, Tablet)
   */
  async function seedMultiSession(
    userId: string,
    sessions: { deviceId: string; refreshJti: string }[],
  ) {
    const userKey = AuthKeyUtil.getUserKey(userId);
    for (const sess of sessions) {
      const storage = {
        accessToken: 'valid-at',
        refreshJti: sess.refreshJti,
        lastActive: Date.now(),
      };
      await redisClient.hset(userKey, sess.deviceId, JSON.stringify(storage));
    }
  }

  /**
   * Scenario: Token Replay Attack Detection.
   * Condition: Attacker uses a stolen Refresh Token with a JTI that has been rotated.
   * Expectation: The service identifies that the stored JTI for that device is different,
   * then deletes the entire Hash key for the user.
   */
  it('should revoke ALL device sessions when a single compromised refresh token is replayed', async () => {
    const userKey = AuthKeyUtil.getUserKey(mockUserId);
    const validJtiForDesktop = uuidv4();
    const attackerStolenJti = 'leaked-jti-from-past';

    // 1. User has sessions on 3 devices
    await seedMultiSession(mockUserId, [
      { deviceId: 'desktop', refreshJti: validJtiForDesktop },
      { deviceId: 'mobile', refreshJti: 'valid-mobile-jti' },
      { deviceId: 'tablet', refreshJti: 'valid-tablet-jti' },
    ]);

    // 2. Attacker replays an old token for 'desktop'
    const stolenRt = jwtService.sign({
      sub: mockUserId,
      deviceId: 'desktop',
      jti: attackerStolenJti,
    });

    // Act: Attempt to refresh with stolen token
    await expect(service.refreshToken(stolenRt)).rejects.toThrow();

    // Assert: ALL sessions (desktop, mobile, tablet) must be purged from Redis
    const remainingSessions = await redisClient.exists(userKey);
    expect(remainingSessions).toBe(0); // Account lockdown successful
  });
});
