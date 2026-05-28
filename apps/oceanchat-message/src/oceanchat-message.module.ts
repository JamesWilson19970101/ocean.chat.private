import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import {
  databaseConfiguration,
  Env,
  natsConfiguration,
  PinoLevelToSeverityNumber,
  PinoLevelToSeverityText,
  redisConfiguration,
  validationSchema,
} from '@ocean.chat/cores';
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { IdGeneratorModule } from '@ocean.chat/id-generator';
import { MonkeyModule } from '@ocean.chat/monkey';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisModule } from '@ocean.chat/redis';
import { TracingOptions } from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { Connection } from 'mongoose';
import { RetentionPolicy, StorageType } from 'nats';
import { LoggerModule, PinoLogger } from 'nestjs-pino';

import { NatsImRouteSubscriber } from './nats-im-route.subscriber';
import { OceanchatMessageController } from './oceanchat-message.controller';
import { OceanchatMessageService } from './oceanchat-message.service';

@Module({})
export class OceanchatMessageModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatMessageModule,
      imports: [
        ConfigModule.forRoot({
          load: [natsConfiguration, redisConfiguration, databaseConfiguration],
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
              directConnection: process.env.NODE_ENV !== 'production',
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
                  subjects: ['im.route.>', 'im.orchestrate.msg'], // TODO: The flow of these two subjects can actually be separated.
                  retention: RetentionPolicy.Limits,
                  storage: StorageType.File,
                  replicas: isProduction ? 3 : 1,
                  max_age: 30 * 60 * 1_000_000_000, // 30 minutes in nanoseconds
                  description: i18nService.translate(
                    'IM_HANDOFF_STREAM_DESCRIPTION',
                  ),
                }, // TODO: malicious attacks casuing storage fill up need to be addressed
                {
                  name: 'IM_DOWNBOUND',
                  subjects: ['im.down.node.>'],
                  retention: RetentionPolicy.Interest,
                  storage: StorageType.Memory,
                  replicas: isProduction ? 3 : 1,
                  max_age: 5 * 60 * 1_000_000_000, // 5 minutes in nanoseconds
                  description: i18nService.translate(
                    'IM_DOWNBOUND_STREAM_DESCRIPTION',
                  ),
                },
              ],
            };
          },
        }),
        MonkeyModule,
        IdGeneratorModule,
      ],
      controllers: [OceanchatMessageController],
      providers: [OceanchatMessageService, NatsImRouteSubscriber],
    };
  }
}
