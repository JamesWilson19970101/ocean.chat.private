import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { I18nModule } from '@ocean.chat/i18n';
import { ModelsModule, MongoModule } from '@ocean.chat/models';
import { IncomingMessage, ServerResponse } from 'http';
import { Connection } from 'mongoose';
import { LoggerModule, PinoLogger } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  databaseConfiguration,
  redisConfiguration,
} from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    I18nModule.forRoot(),
    ConfigModule.forRoot({
      load: [databaseConfiguration, redisConfiguration],
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
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService, logger: PinoLogger) => ({
        uri: configService.get<string>('database.uri'),
        dbName: configService.get<string>('database.name'),
        serverSelectionTimeoutMS: 5000,
        onConnectionCreate: (connection: Connection) => {
          connection.on('connected', () => {
            logger.setContext('database.module');
            logger.info('Database connected successfully');
          });
          return connection;
        },
      }),
      inject: [ConfigService, PinoLogger],
    }),
    ModelsModule,
    // Using MongoModule to register collections for watching
    MongoModule.register(['users', 'settings']),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
