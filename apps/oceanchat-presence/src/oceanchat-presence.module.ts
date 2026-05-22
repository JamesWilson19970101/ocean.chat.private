import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import {
  Env,
  natsConfiguration,
  PinoLevelToSeverityNumber,
  PinoLevelToSeverityText,
  redisConfiguration,
  validationSchema,
} from '@ocean.chat/cores';
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { NatsTraceInterceptor } from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { TracingOptions } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { NatsPresenceEventsSubscriber } from './nats-presence-events.subscriber';
import { OceanchatPresenceController } from './oceanchat-presence.controller';
import { OceanchatPresenceService } from './oceanchat-presence.service';

@Module({})
export class OceanchatPresenceModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatPresenceModule,
      imports: [
        I18nModule.forRoot(),
        ConfigModule.forRoot({
          load: [redisConfiguration, natsConfiguration],
          validationSchema,
          envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
          isGlobal: true,
        }),
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
                    const message = inputArgs[inputArgs.length - 1];
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
                      options: { colorize: true, singleLine: true },
                    }
                  : undefined,
            },
          }),
        }),
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
        NatsJetStreamProvisionerModule.forRootAsync({
          inject: [I18nService],
          useFactory: () => ({
            natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
            streamConfigs: [], // Presence is configured via core if applicable, or ephemeral config here.
          }),
        }),
      ],
      controllers: [OceanchatPresenceController],
      providers: [
        { provide: SERVICE_NAME, useValue: options.serviceName },
        { provide: SERVICE_INSTANCE_ID, useValue: options.serviceInstanceId },
        { provide: APP_INTERCEPTOR, useClass: NatsTraceInterceptor },
        OceanchatPresenceService,
        NatsPresenceEventsSubscriber,
      ],
    };
  }
}
