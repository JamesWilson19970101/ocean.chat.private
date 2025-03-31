import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { I18nModule } from '@ocean.chat/i18n';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    I18nModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
