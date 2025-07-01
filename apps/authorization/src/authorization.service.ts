import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  IConnectionOptions,
  IoRedisAdapter,
} from '@ocean.chat/casbin-ioredis-adapter';
import { I18nService } from '@ocean.chat/i18n';
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
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
  ) {}

  async onModuleInit() {
    const modelPath = join(__dirname, '/authorization_assets/model.conf'); // Adjust path relative to dist/

    this.logger.info(
      this.i18nService.translate('Using_Casbin_Model', {
        modelPath,
      }),
    );

    const redisConnectionOptions: IConnectionOptions = {
      host: this.configService.get<string>('redis.host') as string,
      port: this.configService.get<number>('redis.port') as number,
      // TODO: Add password in production
    };
    const adapter = await IoRedisAdapter.newAdapter(redisConnectionOptions);
    this.enforcer = await newEnforcer(modelPath, adapter);
  }

  getHello(): string {
    return 'Hello World!';
  }
}
