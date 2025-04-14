import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { I18nModule } from '@ocean.chat/i18n';
import { ModelsModule } from '@ocean.chat/models';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';

import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AuthGuard } from './auth.guard';
import configuration from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { jwtConstants } from './constants';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    I18nModule.forRoot(),
    ConfigModule.forRoot({
      load: [configuration],
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
    DatabaseModule,
    ModelsModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '600s' },
    }),
  ],
  controllers: [AccountController],
  // TODO: at the time, the authentication guard is only can be used in account module.
  providers: [AccountService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AccountModule {}
