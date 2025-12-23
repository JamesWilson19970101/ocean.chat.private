import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PermissionGuard } from '@ocean.chat/authorization';
import { AuthorizationModule } from '@ocean.chat/authorization';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import {
  Env,
  IdempotencyInterceptor,
  jwtConfiguration,
  natsConfiguration,
  redisConfiguration,
  restConfiguration,
  validationSchema,
} from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { NatsOpentelemetryTracingModule } from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import { context, trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

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
            redisConfiguration,
            jwtConfiguration,
            natsConfiguration,
            restConfiguration,
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
          useFactory: (configService: ConfigService) => ({
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            db: configService.get<number>('redis.db'),
          }),
          inject: [ConfigService],
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
        ThrottlerModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            errorMessage: 'Too many requests, please try again later.',
            throttlers: [
              {
                ttl: 1000, // 1 second
                limit: configService.get<number>('rest.rate_limit', 10), // 10 requests per second per IP
              },
            ],
            storage: new ThrottlerStorageRedisService({
              host: configService.get<string>('redis.host'),
              port: configService.get<number>('redis.port'),
              db: configService.get<number>('redis.db'),
            }),
          }),
        }),
        AuthorizationModule,
        AuthModule,
        UsersModule,
      ],
      providers: [
        // Register ThrottlerGuard globally. It should run before authentication
        // to protect the auth endpoints themselves from brute-force attacks.
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
        // Register JwtAuthGuard globally. All routes will be protected by default.
        // Use @SkipAuth() decorator to make specific routes public.
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        // Register PermissionGuard globally. It will run after JwtAuthGuard.
        // This ensures that authentication happens before authorization checks.
        {
          provide: APP_GUARD,
          useClass: PermissionGuard,
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
