import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { CachedResponse } from '@ocean.chat/types';
import type { Request, Response } from 'express';
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
  ) {}

  // Default TTL if not specified on the route
  private readonly DEFAULT_CACHE_TTL = 24 * 60 * 60; // 24 hours
  private readonly DEFAULT_JITTER = 60 * 60; // 1 hour

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

    const reflector = new Reflector();
    const routeOptions = reflector.get<IdempotencyMetadata>(
      IDEMPOTENCY_OPTIONS_KEY,
      context.getHandler(),
    );

    const cacheTtl = routeOptions?.cacheTtl ?? this.DEFAULT_CACHE_TTL;

    // Acquire lock
    const redisKey = getIdempotencyRedisKey(idempotencyKey);
    // Increase processing TTL to handle network jitter or slow downstream services.
    // For IM systems, holding the lock longer to prevent duplicate data is preferred
    // over complex distributed transaction compensation mechanisms.
    const processingTtl = 60;
    const lockAcquired = await this.redisService.setnx(
      redisKey,
      JSON.stringify({ status: 'processing' }),
      processingTtl,
    );

    if (!lockAcquired) {
      // lock not acquired, check current state
      const cachedString = await this.redisService.get(redisKey);
      let cached: CachedResponse | null = null;
      if (cachedString) {
        // TODO: process error
        cached = JSON.parse(cachedString) as CachedResponse;
      }
      if (cached?.status === 'completed') {
        const response = httpContext.getResponse<Response>();
        response.status(cached.statusCode);
        return of(cached.body);
      }
      const message = this.i18nService.translate('IDEMPOTENCY_CONFLICT');
      // For conflicts, we throw an exception that will be handled by the global filter.
      throw new BaseException(
        message,
        HttpStatus.CONFLICT,
        ErrorCodes.IDEMPOTENCY_CONFLICT, // Assuming this error code exists or will be added.
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
        // If error, delete the key so client can retry
        await this.redisService.del(redisKey);
      }
      return of(body);
    } catch (error) {
      // If exception, delete the key so client can retry
      await this.redisService.del(redisKey);
      throw error;
    }
  }
}
