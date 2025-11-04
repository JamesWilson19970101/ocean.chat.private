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
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';

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

    const result = await this.redisService.executeIdempotently(
      getIdempotencyRedisKey(idempotencyKey),
      async () => {
        // This is the 'fetcher' function. It will only be executed
        // if the lock is successfully acquired.
        const body = await next.handle().toPromise();
        const statusCode = httpContext.getResponse<Response>().statusCode;
        return { body, statusCode };
      },
      {
        processingTtl: 30, // 30 seconds for the processing lock
        cacheTtl,
        ttlJitter: this.DEFAULT_JITTER,
      },
    );
    const response = httpContext.getResponse<Response>();
    response.status(result.statusCode);

    if (result.status === 'CONFLICT') {
      const message = this.i18nService.translate('IDEMPOTENCY_CONFLICT');
      // For conflicts, we throw an exception that will be handled by the global filter.
      throw new BaseException(
        message,
        HttpStatus.CONFLICT,
        ErrorCodes.IDEMPOTENCY_CONFLICT, // Assuming this error code exists or will be added.
        { idempotencyKey },
      );
    }
    // For 'EXECUTED' and 'CACHED' statuses, we return the body as an Observable.
    return of(result.body);
  }
}
