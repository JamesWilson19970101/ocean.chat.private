import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { CachedResponse } from '@ocean.chat/types';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { firstValueFrom, Observable, of } from 'rxjs';

import {
  IDEMPOTENCY_OPTIONS_KEY,
  IdempotencyMetadata,
} from '../decorators/idempotency.decorator';
import { getIdempotencyRedisKey } from '../utils/idempotency.utils';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger(IdempotencyInterceptor.name)
    private readonly logger: PinoLogger,
    private readonly reflector: Reflector,
  ) {}

  // Default TTL if not specified on the route
  private readonly DEFAULT_CACHE_TTL = 30 * 60; // 30 minutes
  private readonly DEFAULT_JITTER = 5 * 60; // 5 minutes
  private readonly DEFAULT_PROCESSING_TTL = 60; // 60 seconds
  private readonly IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
  private readonly METHODS_TO_CHECK = ['POST', 'PUT', 'PATCH'];

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    if (!this.METHODS_TO_CHECK.includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers[
      this.IDEMPOTENCY_KEY_HEADER
    ] as string;

    // If no key, proceed without idempotency
    if (!idempotencyKey) {
      return next.handle();
    }

    const routeOptions = this.reflector.get<IdempotencyMetadata>(
      IDEMPOTENCY_OPTIONS_KEY,
      context.getHandler(),
    );

    const cacheTtl = routeOptions?.cacheTtl ?? this.DEFAULT_CACHE_TTL;

    // Acquire lock
    const redisKey = getIdempotencyRedisKey(idempotencyKey);
    const processingValue = JSON.stringify({ status: 'processing' });

    // Increase processing TTL to handle network jitter or slow downstream services.
    // For IM systems, holding the lock longer to prevent duplicate data is preferred
    // over complex distributed transaction compensation mechanisms.
    const lockAcquired = await this.redisService.setnx(
      redisKey,
      processingValue,
      this.DEFAULT_PROCESSING_TTL,
    );

    if (!lockAcquired) {
      // lock not acquired, check current state
      const cachedString = await this.redisService.get(redisKey);
      let cached: CachedResponse | null = null;
      if (cachedString) {
        try {
          cached = JSON.parse(cachedString) as CachedResponse;
        } catch (e) {
          this.logger.error(
            { err: e, redisKey },
            this.i18nService.translate('Failed_to_parse_redis_value', {
              key: redisKey,
            }),
          );
        }
      }
      if (cached?.status === 'completed') {
        const response = httpContext.getResponse<Response>();
        response.status(cached.statusCode);
        return of(cached.body);
      }
      const message = this.i18nService.translate('IDEMPOTENCY_CONFLICT');
      // For conflicts, throw an exception that will be handled by the global filter.
      throw new DomainException(
        message,
        ErrorCodes.IDEMPOTENCY_CONFLICT,
        HttpStatus.CONFLICT,
        { idempotencyKey },
      );
    }
    // Lock acquired, execute the operation.
    try {
      const body = await firstValueFrom(next.handle());
      const response = httpContext.getResponse<Response>();
      const statusCode = response.statusCode;

      // Cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        const cache: CachedResponse = {
          status: 'completed',
          body,
          statusCode,
        };
        const jitter = Math.floor(Math.random() * this.DEFAULT_JITTER);
        await this.redisService.set(redisKey, cache, cacheTtl + jitter);
      } else {
        // Safe release: Only delete if it's STILL in processing state.
        // Prevents deleting a successful cache from a concurrent retry if this request took longer than the lock TTL.
        await this.redisService
          .delIfEqual(redisKey, processingValue)
          .catch((err) => {
            this.logger.error(
              { err, redisKey },
              this.i18nService.translate(
                'FAILED_TO_RELEASE_IDEMPOTENCY_LOCK_STATUS',
              ),
            );
          });
      }
      return of(body);
    } catch (error) {
      // Safe release: Only delete if it's STILL in processing state.
      await this.redisService
        .delIfEqual(redisKey, processingValue)
        .catch((err) => {
          this.logger.error(
            { err, redisKey },
            this.i18nService.translate(
              'FAILED_TO_RELEASE_IDEMPOTENCY_LOCK_EXCEPTION',
            ),
          );
        });
      throw error;
    }
  }
}
