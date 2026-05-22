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
import { I18nModule } from '@ocean.chat/i18n';
import { ModelsModule, OceanModel } from '@ocean.chat/models';
import { RedisModule } from '@ocean.chat/redis';
import { TracingOptions } from '@ocean.chat/types';
import { context, trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';

import { OceanchatQueryController } from './oceanchat-query.controller';
import { OceanchatQueryService } from './oceanchat-query.service';

export const SERVICE_INSTANCE_ID = 'SERVICE_INSTANCE_ID';
export const SERVICE_NAME = 'SERVICE_NAME';

@Module({})
export class OceanchatQueryModule {
  static forRoot(options: TracingOptions): DynamicModule {
    return {
      module: OceanchatQueryModule,
      imports: [
        I18nModule.forRoot(),
        ConfigModule.forRoot({
          load: [redisConfiguration, databaseConfiguration, natsConfiguration],
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
          useFactory: (configService: ConfigService) => ({
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            db: configService.get<number>('redis.db'),
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
        ModelsModule.forFeature([OceanModel.Message]),
      ],
      controllers: [OceanchatQueryController],
      providers: [OceanchatQueryService],
    };
  }
}
