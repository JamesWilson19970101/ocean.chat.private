import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import {
  databaseConfiguration,
  natsConfiguration,
  PinoLevelToSeverityNumber,
  PinoLevelToSeverityText,
  redisConfiguration,
} from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { ModelsModule, OceanModel } from '@ocean.chat/models';
import { RedisModule } from '@ocean.chat/redis';
import { TracingOptions } from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { NatsCursorStateSubscriber } from './nats-cursor-state.subscriber';
import { NatsOrchestrateSubscriber } from './nats-orchestrate.subscriber';
import { OceanchatMessagePersistenceWorkerController } from './oceanchat-message-persistence-worker.controller';
import { OceanchatMessagePersistenceWorkerService } from './oceanchat-message-persistence-worker.service';

@Module({})
export class OceanchatMessagePersistenceWorkerModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatMessagePersistenceWorkerModule,
      imports: [
        ConfigModule.forRoot({
          load: [natsConfiguration, databaseConfiguration, redisConfiguration],
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
                      options: { colorize: true, singleLine: true },
                    }
                  : undefined,
            },
          }),
        }),
        CommonExceptionsModule.forRoot({
          serviceName: 'oceanchat-message-persistence-worker',
          serviceInstanceId: 'default',
        }),
        RedisModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            host: configService.get<string>('redis.host', '127.0.0.1'),
            port: configService.get<number>('redis.port', 6379),
            db: configService.get<number>('redis.db', 2),
          }),
          inject: [ConfigService],
        }),
        MongooseModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            uri: configService.get<string>('database.uri'),
            dbName: configService.get<string>('database.name'),
          }),
          inject: [ConfigService],
        }),
        ModelsModule.forFeature([OceanModel.Message, OceanModel.GroupMember]),
      ],
      controllers: [OceanchatMessagePersistenceWorkerController],
      providers: [
        OceanchatMessagePersistenceWorkerService,
        NatsOrchestrateSubscriber,
        NatsCursorStateSubscriber,
      ],
    };
  }
}
