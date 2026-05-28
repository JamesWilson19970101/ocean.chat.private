import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import {
  databaseConfiguration,
  Env,
  jwtConfiguration,
  natsConfiguration,
  PinoLevelToSeverityNumber,
  PinoLevelToSeverityText,
  redisConfiguration,
  validationSchema,
} from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { NatsOpentelemetryTracingModule } from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import { TracingOptions } from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { NatsOrchestrateSubscriber } from './nats-orchestrate.subscriber';
import { OceanchatOrchestratorController } from './oceanchat-orchestrator.controller';
import { OceanchatOrchestratorService } from './oceanchat-orchestrator.service';

@Module({})
export class OceanchatOrchestratorModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatOrchestratorModule,
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
        NatsJetStreamProvisionerModule.forRootAsync({
          useFactory: () => {
            return {
              natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
              streamConfigs: [],
            };
          },
        }),
        NatsOpentelemetryTracingModule.registerAsync([
          {
            name: 'GROUP_SERVICE',
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              servers: [configService.get<string>('nats.url') as string],
            }),
            inject: [ConfigService],
          },
        ]),
      ],
      controllers: [OceanchatOrchestratorController],
      providers: [OceanchatOrchestratorService, NatsOrchestrateSubscriber],
    };
  }
}
