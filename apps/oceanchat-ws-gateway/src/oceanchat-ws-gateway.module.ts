import { CacheModule } from '@nestjs/cache-manager';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import {
  Env,
  jwtConfiguration,
  natsConfiguration,
  PinoLevelToSeverityNumber,
  PinoLevelToSeverityText,
  redisConfiguration,
  restConfiguration,
  TokenBlacklistService,
  validationSchema,
} from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { MonkeyModule } from '@ocean.chat/monkey';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { NatsTraceInterceptor } from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import {
  SERVICE_INSTANCE_ID,
  SERVICE_NAME,
  TracingOptions,
} from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { RetentionPolicy, StorageType } from 'nats';
import { LoggerModule } from 'nestjs-pino';

import { NatsAuthEventsSubscriber } from './nats-auth-events.subscriber';
import { NatsDownboundSubscriber } from './nats-downbound.subscriber';
// import { NatsSyncSubscriber } from './nats-sync.subscriber';
import { OceanchatWsGatewayController } from './oceanchat-ws-gateway.controller';
import { OceanchatWsGateway } from './oceanchat-ws-gateway.gateway';
import { OceanchatWsGatewayProcessor } from './oceanchat-ws-gateway.processor';
import { OceanchatWsGatewayService } from './oceanchat-ws-gateway.service';

@Module({})
export class OceanchatWsGatewayModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatWsGatewayModule,
      imports: [
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
        I18nModule.forRoot(),
        LoggerModule.forRootAsync({
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
        CommonExceptionsModule.forRoot({
          serviceName: options.serviceName,
          serviceInstanceId: options.serviceInstanceId,
        }),

        NatsJetStreamProvisionerModule.forRootAsync({
          useFactory: () => {
            const isProduction = process.env.NODE_ENV === 'production';
            return {
              natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
              streamConfigs: [
                {
                  name: 'SYS_PRESENCE',
                  subjects: ['presence.conn.*'],
                  retention: RetentionPolicy.Limits,
                  storage: StorageType.Memory,
                  replicas: isProduction ? 3 : 1,
                  max_age: 5 * 60 * 1_000_000_000, // 5 mins
                },
                {
                  name: 'IM_CORE',
                  subjects: ['im.up.>'],
                  retention: RetentionPolicy.Workqueue,
                  storage: StorageType.File,
                  replicas: isProduction ? 3 : 1,
                  max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days Allow sufficient time for engineers to fix the problem.
                },
                {
                  name: 'CURSOR_STATE',
                  subjects: ['cursor.read.>'],
                  retention: RetentionPolicy.Limits,
                  storage: StorageType.Memory,
                  max_msgs_per_subject: 1, // Core magic for folding storm
                  replicas: isProduction ? 3 : 1,
                  description:
                    'Cursor state persistence stream for folding read receipts',
                },
                {
                  name: 'DEVICE_SYNC',
                  subjects: ['sync.cursor.read.>'],
                  retention: RetentionPolicy.Interest,
                  storage: StorageType.Memory,
                  replicas: isProduction ? 3 : 1,
                  max_age: 5 * 60 * 1_000_000_000, // 5 mins
                  description:
                    'Device synchronization stream for clearing cross-device badges',
                },
              ],
            };
          },
        }),
        RedisModule.registerAsync({
          useFactory: (configService: ConfigService) => ({
            host: configService.get<string>('redis.host', '127.0.0.1'),
            port: configService.get<number>('redis.port', 6379),
            db: configService.get<number>('redis.db', 2),
          }),
          inject: [ConfigService],
        }),
        JwtModule.registerAsync({
          useFactory: (configService: ConfigService) => ({
            publicKey: configService.get<string>('jwt.accessPublicKey'),
            signOptions: {
              algorithm: 'RS256',
            },
          }),
          inject: [ConfigService],
        }),
        CacheModule.register({
          ttl: 30 * 60 * 1000,
          max: 100000,
        }),
        MonkeyModule,
      ],
      controllers: [OceanchatWsGatewayController],
      providers: [
        {
          provide: SERVICE_NAME,
          useValue: options.serviceName,
        },
        {
          provide: SERVICE_INSTANCE_ID,
          useValue: options.serviceInstanceId,
        },
        // Register NatsTraceInterceptor as a global interceptor.
        {
          provide: APP_INTERCEPTOR,
          useClass: NatsTraceInterceptor,
        },
        OceanchatWsGatewayService,
        OceanchatWsGatewayProcessor,
        OceanchatWsGateway,
        TokenBlacklistService,
        NatsAuthEventsSubscriber,
        NatsDownboundSubscriber,
        // NatsSyncSubscriber,
      ],
    };
  }
}
