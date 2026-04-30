import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { ModelsModule, MongoModule } from '@ocean.chat/models';
import { RedisModule } from '@ocean.chat/redis';
import { SettingsModule } from '@ocean.chat/settings';
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
import { SettingsController } from './settings/settings.controller';

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
    RedisModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('redis.host'),
        port: configService.get<number>('redis.port'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (
        configService: ConfigService,
        logger: PinoLogger,
        i18nService: I18nService,
      ) => {
        return {
          uri: configService.get<string>('database.uri'),
          dbName: configService.get<string>('database.name'),
          serverSelectionTimeoutMS: 5000,
          onConnectionCreate: (connection: Connection) => {
            connection.on('connected', () => {
              logger.setContext('database.module');
              logger.info(i18nService.translate('Database_Connected'));
            });
            return connection;
          },
        };
      },
      inject: [ConfigService, PinoLogger, I18nService],
    }),
    ModelsModule,
    // Using MongoModule to register collections for watching
    MongoModule.register(['users', 'settings']),
    SettingsModule,
  ],
  controllers: [AppController, SettingsController],
  providers: [AppService],
})
export class AppModule {
  constructor(
    // Injecting the logger and i18n service here ensures they are available
    // within the module context if needed, and properly instantiated.
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {}
}
