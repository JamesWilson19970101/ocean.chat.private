import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import { RedisService } from '@ocean.chat/redis';
import { Request, Response } from 'express';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const PROCESSING_TTL_SECONDS = 30; // The max time a request is expected to take.
const RESPONSE_CACHE_TTL_SECONDS = 24 * 60 * 60; // Cache responses for 24 hours.

interface CompletedResponse {
  status: 'completed';
  body: any;
  statusCode: number;
}

interface ProcessingResponse {
  status: 'processing';
}

type CachedResponse = ProcessingResponse | CompletedResponse;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly i18nService: I18nService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as string;

    // If no key, proceed without idempotency
    if (!idempotencyKey) {
      return next.handle();
    }

    const redisKey = `idempotency:${idempotencyKey}`;
    const cached = await this.redisService.get<CachedResponse>(redisKey);

    if (cached) {
      if (cached.status === 'processing') {
        // The original request is still being processed.
        return throwError(
          () => new ConflictException('Request is being processed'),
        );
      }
      if (cached.status === 'completed') {
        // The original request completed, return the cached response.
        const response = httpContext.getResponse<Response>();
        response.status(cached.statusCode);
        return of(cached.body);
      }
    }

    // First time seeing this key. Mark as 'processing'.
    await this.redisService.set<CachedResponse>(
      redisKey,
      { status: 'processing' },
      PROCESSING_TTL_SECONDS,
    );

    // TODO: Intercepting HTTP errors in the controller
    return next.handle().pipe(
      concatMap((body) => {
        const response = httpContext.getResponse<Response>();
        const cache: CachedResponse = {
          status: 'completed',
          body,
          statusCode: response.statusCode,
        };
        // from() converts the Promise from redisService.set into an Observable
        return from(
          this.redisService.set(redisKey, cache, RESPONSE_CACHE_TTL_SECONDS),
        ).pipe(
          // After caching is done, return the original body to continue the stream
          concatMap(() => of(body)),
        );
      }),
      catchError(async (err) => {
        // If an error occurs, remove the processing key to allow retries.
        await this.redisService.del(redisKey);
        throw err; // Re-throw the original error.
      }),
    );
  }
}
