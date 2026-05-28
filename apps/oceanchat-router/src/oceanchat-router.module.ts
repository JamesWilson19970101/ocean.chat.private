import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { MonkeyModule } from '@ocean.chat/monkey';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisModule } from '@ocean.chat/redis';
import { TracingOptions } from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { RetentionPolicy, StorageType } from 'nats';
import { LoggerModule } from 'nestjs-pino';

import { NatsImUpSubscriber } from './nats-im-up.subscriber';
import { OceanchatRouterController } from './oceanchat-router.controller';
import { OceanchatRouterService } from './oceanchat-router.service';

@Module({})
export class OceanchatRouterModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatRouterModule,
      imports: [
        ConfigModule.forRoot({
          load: [natsConfiguration, redisConfiguration],
          validationSchema,
          envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
          isGlobal: true,
        }),
        I18nModule.forRoot(),
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
          useFactory: (i18nService: I18nService) => {
            const isProduction = process.env.NODE_ENV === 'production';
            return {
              // NATS server URL, configurable via environment variables.
              natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
              streamConfigs: [
                {
                  name: 'IM_HANDOFF',
                  subjects: ['im.route.>', 'im.orchestrate.msg'],
                  retention: RetentionPolicy.Limits,
                  storage: StorageType.File,
                  replicas: isProduction ? 3 : 1,
                  max_age: 30 * 60 * 1_000_000_000, // 30 minutes in nanoseconds
                  description: i18nService.translate(
                    'IM_HANDOFF_STREAM_DESCRIPTION',
                  ),
                }, // TODO: malicious attacks casuing storage fill up need to be addressed
              ],
            };
          },
        }),
        MonkeyModule,
      ],
      controllers: [OceanchatRouterController],
      providers: [OceanchatRouterService, NatsImUpSubscriber],
    };
  }
}
