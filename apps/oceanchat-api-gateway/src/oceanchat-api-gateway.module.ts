import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { NatsOpentelemetryTracingModule } from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import { context, trace } from '@opentelemetry/api';
import { Connection } from 'mongoose';
import { LoggerModule, PinoLogger } from 'nestjs-pino';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import {
  databaseConfiguration,
  jwtConfiguration,
  natsConfiguration,
  redisConfiguration,
} from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { JwtStrategy } from './modules/auth/jwt.strategy';

export const SERVICE_INSTANCE_ID = 'SERVICE_INSTANCE_ID';
export const SERVICE_NAME = 'SERVICE_NAME';

// map SeverityNumber
// https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
const PinoLevelToSeverityNumber = {
  10: 1, // TRACE
  20: 5, // DEBUG
  30: 9, // INFO
  40: 13, // WARN
  50: 17, // ERROR
  60: 21, // FATAL
};

// map SeverityNumber to text
const PinoLevelToSeverityText = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

interface OceanchatApiGatewayModuleOptions {
  serviceName: string;
  serviceInstanceId: string;
}

@Module({})
export class OceanchatApiGatewayModule {
  static forRoot(options: OceanchatApiGatewayModuleOptions): DynamicModule {
    return {
      module: OceanchatApiGatewayModule,
      imports: [
        I18nModule.forRoot(),
        ConfigModule.forRoot({
          load: [
            databaseConfiguration,
            redisConfiguration,
            jwtConfiguration,
            natsConfiguration,
          ],
          validationSchema,
          envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
          isGlobal: true,
        }),
        LoggerModule.forRootAsync({
          providers: [
            {
              provide: SERVICE_NAME,
              useValue: options.serviceName,
            },
            {
              provide: SERVICE_INSTANCE_ID,
              useValue: options.serviceInstanceId,
            },
          ],
          inject: [SERVICE_NAME, SERVICE_INSTANCE_ID],
          useFactory: (serviceName: string, serviceInstanceId: string) => ({
            pinoHttp: {
              level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
              mixin: () => ({
                currentService: `${serviceName}::${serviceInstanceId}`,
              }),
              hooks: {
                logMethod(inputArgs, method, level) {
                  const activeSpan = trace.getSpan(context.active());

                  if (activeSpan) {
                    const message = inputArgs[inputArgs.length - 1]; // get message string

                    activeSpan.addEvent(
                      `Pino-Log-${PinoLevelToSeverityText[level]}`,
                      {
                        'log.severity':
                          PinoLevelToSeverityNumber[level] || level,
                        'log.message': message,
                      },
                    );
                  }
                  return method.apply(this, inputArgs) as unknown;
                },
              },
              transport:
                process.env.NODE_ENV !== 'production'
                  ? {
                      target: 'pino-pretty',
                      options: {
                        colorize: true,
                        singleLine: true,
                      },
                    }
                  : undefined,
            },
          }),
        }),
        // CommonExceptionsModule should come after tracing so the filter can be injected
        // into the interceptor if needed in the future.
        CommonExceptionsModule.forRoot({
          serviceName: options.serviceName,
          serviceInstanceId: options.serviceInstanceId,
        }),
        RedisModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            db: configService.get<number>('redis.db'),
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
                  logger.info(
                    { dbName: configService.get<string>('database.name') },
                    i18nService.translate('Database_Connected'),
                  );
                });
                return connection;
              },
            };
          },
          inject: [ConfigService, PinoLogger, I18nService],
        }),
        // Use the enhanced module to register multiple traceable NATS clients.
        NatsOpentelemetryTracingModule.registerAsync([
          {
            name: 'AUTH_SERVICE',
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              // The factory returns the options for the underlying NATS client
              servers: [configService.get<string>('nats.url') as string],
            }),
            inject: [ConfigService],
          },
          {
            name: 'USER_SERVICE',
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              servers: [configService.get<string>('nats.url') as string],
            }),
            inject: [ConfigService],
          },
        ]),
        PassportModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          // eslint-disable-next-line @typescript-eslint/require-await
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get<string>('jwt.accessSecret'),
            signOptions: {
              expiresIn: configService.get<string>('jwt.accessExpiresIn'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        JwtStrategy,
        // Register JwtAuthGuard globally. All routes will be protected by default.
        // Use @SkipAuth() decorator to make specific routes public.
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        // Register the IdempotencyInterceptor as a global interceptor.
        // NestJS will handle its instantiation and dependency injection.
        {
          provide: APP_INTERCEPTOR,
          useClass: IdempotencyInterceptor,
        },
      ],
    };
  }
}
