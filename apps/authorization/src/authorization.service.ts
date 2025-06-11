import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Enforcer, newEnforcer } from 'casbin';
import Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { join } from 'path';

@Injectable()
export class AuthorizationService implements OnModuleInit {
  private enforcer: Enforcer;

  constructor(
    @InjectPinoLogger('authorization.authorization.module')
    private readonly logger: PinoLogger,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    const modelPath = join(__dirname, '/authorization_assets/model.conf'); // Adjust path relative to dist/
    this.logger.info(`Using Casbin model from: ${modelPath}`);
    // TODO: write an adapter with ioredis, apply it to the enforcer
    // try {
    // } catch (error) {}
  }

  getHello(): string {
    return 'Hello World!';
  }
}
