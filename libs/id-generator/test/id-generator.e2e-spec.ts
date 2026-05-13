import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from '@ocean.chat/i18n';
import {
  Sequence,
  SequenceRepository,
  SequenceSchema,
} from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import Redis from 'ioredis';
import { connect, connection, Model } from 'mongoose';
import { getLoggerToken } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

import { REDIS_CLIENT } from '../../redis/src/redis.provider';
import { IdGeneratorService } from '../src/id-generator.service';

/**
 * @file ID Generator Integration (E2E) Test Suite
 *
 * Focus: Live testing of Redis Lua script and MongoDB atomic $inc.
 * This adheres to the "nestjs pragmatic testing" skill by testing against REAL infrastructure.
 */
describe('IdGeneratorService (Real Infrastructure E2E)', () => {
  let service: IdGeneratorService;
  let redisClient: Redis;
  let sequenceModel: Model<Sequence>;

  const MONGO_URI =
    process.env.MONGO_URI || 'mongodb://localhost:27017/oceanchat_test';
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/15'; // using db 15 for test isolation

  beforeAll(async () => {
    // 1. Connect to Real MongoDB
    await connect(MONGO_URI);

    // 2. Connect to Real Redis
    redisClient = new Redis(REDIS_URL);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdGeneratorService,
        RedisService,
        SequenceRepository,
        {
          provide: REDIS_CLIENT,
          useValue: redisClient,
        },
        {
          provide: getModelToken(Sequence.name),
          useFactory: () => connection.model(Sequence.name, SequenceSchema),
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        {
          provide: getLoggerToken(IdGeneratorService.name),
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: getLoggerToken('redis.module'),
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IdGeneratorService>(IdGeneratorService);
    sequenceModel = module.get<Model<Sequence>>(getModelToken(Sequence.name));
  });

  afterAll(async () => {
    await connection.close();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clean up both Mongo and Redis before each test
    await sequenceModel.deleteMany({});
    await redisClient.flushdb();
  });

  it('should generate strictly monotonic IDs starting from 1', async () => {
    const key = `test_entity_${uuidv7()}`;

    // First call should hit slow path (Mongo allocation) and return 1
    const id1 = await service.generateSyncSeqId(key);
    expect(id1).toBe('1');

    // Second call should hit fast path (Redis Lua) and return 2
    const id2 = await service.generateSyncSeqId(key);
    expect(id2).toBe('2');

    // Third call
    const id3 = await service.generateSyncSeqId(key);
    expect(id3).toBe('3');

    // Verify Redis holds the segment
    const redisHash = await redisClient.hgetall(`seq:${key}`);
    expect(redisHash.cur).toBe('3');
    expect(redisHash.max).toBe('1000'); // Based on STEP = 1000 in service
  });

  it('should handle concurrent ID generation without collisions', async () => {
    const key = `test_entity_concurrent_${uuidv7()}`;
    const concurrentRequests = 1500; // More than 1 STEP size to trigger reallocation

    const pLimitModule = await import('p-limit');
    const pLimit = pLimitModule.default || pLimitModule;

    // Act: Fire requests concurrently
    const start = Date.now();
    const limit = pLimit(200);
    const ids = await Promise.all(
      Array.from({ length: concurrentRequests }).map(() =>
        limit(() => service.generateSyncSeqId(key)),
      ),
    );
    const duration = Date.now() - start;
    console.log(`Generated ${concurrentRequests} IDs in ${duration}ms`);

    // Assert: Check no duplicates
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(concurrentRequests);

    // Sort to verify monotonicity boundaries
    const sortedIds = ids
      .map((id) => BigInt(id))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // Check first and last
    expect(sortedIds[0].toString()).toBe('1');
    expect(sortedIds[sortedIds.length - 1].toString()).toBe(
      concurrentRequests.toString(),
    );

    // Verify final state in DB and Redis
    const dbRecord = await sequenceModel.findById(key).lean();
    expect(dbRecord?.max.toString()).toBe('2000'); // 2 allocations of 1000 each

    const redisHash = await redisClient.hgetall(`seq:${key}`);
    expect(redisHash.max).toBe('2000');
    expect(redisHash.cur).toBe(concurrentRequests.toString());
  }, 10000); // Allow longer timeout for concurrency

  it('should prevent duplicate IDs by allocating a new segment if Redis data is completely lost (e.g., Master crash before syncing key)', async () => {
    const key = `test_entity_loss_${uuidv7()}`;

    // 1. Initial generation (allocates 1~1000)
    const id1 = await service.generateSyncSeqId(key);
    expect(id1).toBe('1');
    const id2 = await service.generateSyncSeqId(key);
    expect(id2).toBe('2');

    // 2. Simulate Redis total data loss (Key is gone during failover)
    await redisClient.del(`seq:${key}`);

    // 3. Next generation. Should NOT return 3, but should hit DB and allocate next segment (1001~2000)
    const id3 = await service.generateSyncSeqId(key);

    // Demonstrates "Jump forward" to prevent duplicates
    expect(id3).toBe('1001');
    expect(id3).not.toBe(id1);
    expect(id3).not.toBe(id2);
  });

  it('should demonstrate that a business DB unique constraint catches duplicates if Redis async replication lag causes a cur rewind', async () => {
    const key = `test_entity_rewind_${uuidv7()}`;

    // 1. Initial generation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const id1 = await service.generateSyncSeqId(key); // Returns '1'
    const id2 = await service.generateSyncSeqId(key); // Returns '2'

    // 2. Simulate Redis async replication lag.
    // Master incremented cur to 2, but crashed. Slave promotes and only has cur = 1.
    await redisClient.hset(`seq:${key}`, 'cur', '1');

    // 3. Next generation from the "promoted slave" will generate a duplicate ID
    const id3 = await service.generateSyncSeqId(key);
    expect(id3).toBe('2'); // Duplicated!

    // 4. Simulate inserting into a business collection to prove the final safety net
    // (We use sequenceModel as a dummy collection to trigger unique _id constraint)
    await sequenceModel.create({ _id: id2, max: 9999 }); // First business insert succeeds
    await expect(sequenceModel.create({ _id: id3, max: 9999 })).rejects.toThrow(
      /E11000 duplicate key error/,
    );
  });
});
