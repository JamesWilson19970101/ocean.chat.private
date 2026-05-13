import { Injectable } from '@nestjs/common';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
  isAppException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { SequenceRepository } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { ISyncSeqIdGenerator } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

import { GENERATE_SEQ_LUA, SYNC_SEGMENT_LUA } from './constants/lua.constants';

@Injectable()
export class IdGeneratorService implements ISyncSeqIdGenerator {
  // Step size for sequence segment allocation
  private readonly STEP = 1000;
  // Maximum retries for lock acquisition
  private readonly MAX_RETRIES = 60;
  // Base wait time between lock retries in ms
  private readonly RETRY_DELAY_BASE_MS = 50;
  // Maximum random jitter added to wait time in ms
  private readonly RETRY_DELAY_JITTER_MS = 50;
  // Regex for safe keys (alphanumeric, dash, underscore, colon)
  private readonly KEY_VALIDATION_REGEX = /^[a-zA-Z0-9_:-]{1,255}$/;

  constructor(
    @InjectPinoLogger(IdGeneratorService.name)
    private readonly logger: PinoLogger,
    private readonly redisService: RedisService,
    private readonly sequenceRepository: SequenceRepository,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Generates a strictly monotonically increasing 64-bit sequence number.
   *
   * @param key The business entity identifier (e.g., 'group:123')
   * @returns A promise resolving to the sequence number as a string.
   */
  async generateSyncSeqId(key: string): Promise<string> {
    if (!this.KEY_VALIDATION_REGEX.test(key)) {
      throw new DomainException(
        this.i18nService.translate('INVALID_SEQUENCE_KEY', {
          defaultValue: 'Invalid sequence key format',
        }),
        ErrorCodes.INVALID_SEQUENCE_KEY,
        400,
      );
    }

    const redisKey = `seq:${key}`;

    try {
      // 1. FAST PATH: Attempt to generate ID entirely in Redis memory via Lua
      const seq = (await this.redisService.eval(
        GENERATE_SEQ_LUA,
        [redisKey],
        [],
      )) as string | null;

      if (seq) {
        return seq;
      }
    } catch (error) {
      // If Redis eval fails (e.g. network error), fail-fast.
      throw new InfrastructureException(
        this.i18nService.translate('ID_GENERATOR_REDIS_ERROR', {
          defaultValue: 'Redis service unavailable',
        }),
        ErrorCodes.SERVICE_UNAVAILABLE,
        503,
        false,
        { cause: error },
      );
    }

    // 2. SLOW PATH: Redis segment exhausted or uninitialized, fallback to DB allocation
    return this.allocateSegmentAndGenerate(key);
  }

  /**
   * Slow path logic to allocate a new segment from the database and update Redis.
   */
  private async allocateSegmentAndGenerate(key: string): Promise<string> {
    this.logger.debug(
      { key },
      this.i18nService.translate('ID_GENERATOR_SEGMENT_EXHAUSTED', {
        defaultValue: 'Segment exhausted, triggering slow path allocation',
      }),
    );

    const lockKey = `lock:seq:${key}`;
    const redisKey = `seq:${key}`;
    let retries = 0;

    while (retries < this.MAX_RETRIES) {
      // Use UUID v7 to ensure I only release our own lock
      const lockValue = uuidv7();
      let acquired = false;

      try {
        // Acquire distributed lock to prevent cache breakdown
        const setnxResult = await this.redisService.setnx(
          lockKey,
          lockValue,
          5,
        ); // 5 seconds lock
        acquired = setnxResult === 'OK';

        if (!acquired) {
          this.logger.debug(
            { key, retries },
            'Lock acquired by another pod, waiting and retrying...',
          );
          retries++;

          // Add random jitter to prevent thundering herd on Redis when multiple pods wake up
          const delay =
            this.RETRY_DELAY_BASE_MS +
            Math.floor(Math.random() * this.RETRY_DELAY_JITTER_MS);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Before re-attempting lock, check if the other pod already allocated the segment
          const fastPathResult = (await this.redisService.eval(
            GENERATE_SEQ_LUA,
            [redisKey],
            [],
          )) as string | null;

          if (fastPathResult) {
            return fastPathResult;
          }
          continue;
        }

        try {
          // Use SequenceRepository to atomically allocate a segment using MongoDB $inc
          const max = await this.sequenceRepository.allocateSegment(
            key,
            this.STEP,
          );

          // The first ID of the newly allocated segment
          const cur = max - BigInt(this.STEP) + 1n;

          // Synchronize the new segment bounds into Redis via CAS Lua Script
          const synced = await this.redisService.eval(
            SYNC_SEGMENT_LUA,
            [redisKey],
            [max.toString(), cur.toString()],
          );

          if (synced === 1) {
            return cur.toString();
          } else {
            // CAS failed. Lock expired and another pod allocated a newer segment.
            // Discard this obsolete segment and fetch a fresh ID.
            this.logger.warn(
              { key },
              'Delayed allocation detected. Segment discarded to prevent sequence rollback.',
            );

            // Another pod allocated a newer segment while we were blocked.
            // Discard our segment and immediately grab an ID from their fast-path.
            const fastPathResult = (await this.redisService.eval(
              GENERATE_SEQ_LUA,
              [redisKey],
              [],
            )) as string | null;
            if (fastPathResult) {
              return fastPathResult;
            }

            // If fast path fails again (e.g. segment exhausted instantly), let the loop retry
            acquired = false; // We don't want to delete the lock, someone else might own it or it expired
            continue;
          }
        } finally {
          // Release the distributed lock safely (only if we still hold it)
          if (acquired) {
            await this.redisService.delIfEqual(lockKey, lockValue);
          }
        }
      } catch (error) {
        // Prevent double-wrapping if the error is already a standard application exception
        if (isAppException(error)) {
          throw error;
        }

        // Adhere to the Fail-Fast ADR: If DB or Redis fails here, throw 503 Service Unavailable
        throw new InfrastructureException(
          this.i18nService.translate('ID_GENERATOR_ALLOCATION_FAILED', {
            defaultValue: 'Sequence allocation failed',
          }),
          ErrorCodes.SERVICE_ERROR,
          503,
          false,
          { cause: error },
        );
      }
    }

    // Exhausted retries
    throw new InfrastructureException(
      this.i18nService.translate('ID_GENERATOR_LOCK_TIMEOUT', {
        defaultValue: 'Failed to acquire lock for sequence allocation',
      }),
      ErrorCodes.SERVICE_UNAVAILABLE,
      503,
    );
  }
}
