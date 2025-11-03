import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}
}
