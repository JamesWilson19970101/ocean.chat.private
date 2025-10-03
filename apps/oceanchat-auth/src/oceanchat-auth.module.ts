import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { ModelsModule } from '@ocean.chat/models';
import { RedisModule } from '@ocean.chat/redis';
import { IncomingMessage, ServerResponse } from 'http';
import { Connection } from 'mongoose';
import { LoggerModule, PinoLogger } from 'nestjs-pino';

import {
  databaseConfiguration,
  redisConfiguration,
} from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { OceanchatAuthController } from './oceanchat-auth.controller';
import { OceanchatAuthService } from './oceanchat-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from './users/users.module';

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
    CommonExceptionsModule.forRoot({
      serviceName: 'oceanchat-auth',
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
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      // eslint-disable-next-line @typescript-eslint/require-await
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '3d',
        },
      }),
      inject: [ConfigService],
    }),
    ModelsModule,
    UsersModule,
  ],
  controllers: [OceanchatAuthController],
  providers: [OceanchatAuthService, LocalStrategy, JwtStrategy],
})
export class OceanchatAuthModule {}
