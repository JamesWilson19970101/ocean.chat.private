import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { I18nModule } from '@ocean.chat/i18n';
import { ModelsModule } from '@ocean.chat/models';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';

import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { redisConfiguration } from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    I18nModule.forRoot(),
    ConfigModule.forRoot({
      load: [redisConfiguration],
      isGlobal: true,
      validationSchema,
      envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        ...(process.env.NODE_ENV !== 'production'
          ? {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              },
            }
          : {}),
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        serializers: {
          req: (req: IncomingMessage & { id?: number | string }) => {
            // Add type hint for req
            return {
              id: req.id,
              method: req.method,
              url: req.url,
            };
          },
          res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get<string>('redis.host')}:${configService.get<number>('redis.port')}`,
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    ModelsModule,
  ],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
})
export class AuthorizationModule {}
