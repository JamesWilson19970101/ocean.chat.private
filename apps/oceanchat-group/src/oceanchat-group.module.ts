import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { ModelsModule, OceanModel } from '@ocean.chat/models';
import {
  NatsOpentelemetryTracingModule,
  NatsTraceInterceptor,
} from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import { TracingOptions } from '@ocean.chat/types';
import { SERVICE_INSTANCE_ID, SERVICE_NAME } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { Connection } from 'mongoose';
import { LoggerModule, PinoLogger } from 'nestjs-pino';

import { OceanchatGroupController } from './oceanchat-group.controller';
import { OceanchatGroupService } from './oceanchat-group.service';

@Module({})
export class OceanchatGroupModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatGroupModule,
      imports: [
        I18nModule.forRoot(),
        ConfigModule.forRoot({
          load: [databaseConfiguration, redisConfiguration, natsConfiguration],
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
        NatsOpentelemetryTracingModule.registerAsync([
          {
            name: 'USER_SERVICE',
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              servers: [configService.get<string>('nats.url') as string],
            }),
            inject: [ConfigService],
          },
        ]),
        ModelsModule.forFeature([OceanModel.Group, OceanModel.GroupMember]),
      ],
      controllers: [OceanchatGroupController],
      providers: [
        OceanchatGroupService,
        {
          provide: APP_INTERCEPTOR,
          useClass: NatsTraceInterceptor,
        },
      ],
    };
  }
}
