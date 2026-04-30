import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
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
import { I18nModule, I18nService } from '@ocean.chat/i18n';
import { ModelsModule, OceanModel } from '@ocean.chat/models';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { NatsTraceInterceptor } from '@ocean.chat/nats-opentelemetry-tracing';
import { RedisModule } from '@ocean.chat/redis';
import { SettingsModule } from '@ocean.chat/settings';
import { context, trace } from '@opentelemetry/api';
import { Connection } from 'mongoose';
import { RetentionPolicy, StorageType } from 'nats';
import { LoggerModule, PinoLogger } from 'nestjs-pino';

import { LocalAuthGuard } from './common/guards/local-auth.guard';
import { OceanchatAuthController } from './oceanchat-auth.controller';
import { OceanchatAuthService } from './oceanchat-auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from './users/users.module';

interface OceanchatAuthModuleOptions {
  serviceName: string;
  serviceInstanceId: string;
}

export const SERVICE_INSTANCE_ID = 'SERVICE_INSTANCE_ID';
export const SERVICE_NAME = 'SERVICE_NAME';

@Module({})
export class OceanchatAuthModule {
  static forRoot(options: OceanchatAuthModuleOptions): DynamicModule {
    return {
      module: OceanchatAuthModule,
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
        NatsJetStreamProvisionerModule.forRootAsync({
          inject: [I18nService],
          useFactory: (i18nService: I18nService) => {
            const isProduction = process.env.NODE_ENV === 'production';
            return {
              // NATS server URL, configurable via environment variables.
              natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
              streamConfigs: [
                {
                  name: 'AUTH_STATE',
                  subjects: ['auth.jwt.revoke'],
                  retention: RetentionPolicy.Limits,
                  storage: StorageType.Memory,
                  replicas: isProduction ? 3 : 1,
                  max_age: 30 * 60 * 1_000_000_000, // 30 minutes in nanoseconds
                  description: i18nService.translate(
                    'AUTH_STATE_STREAM_DESCRIPTION',
                  ),
                },
                {
                  name: 'AUTH_EVENTS',
                  subjects: ['auth.event.>'],
                  retention: isProduction
                    ? RetentionPolicy.Limits
                    : RetentionPolicy.Workqueue,
                  storage: StorageType.File,
                  replicas: isProduction ? 3 : 1,
                  max_age: 24 * 60 * 60 * 1_000_000_000, // 24 hours
                  description: i18nService.translate(
                    'AUTH_EVENTS_STREAM_DESCRIPTION',
                  ),
                },
                {
                  name: 'AUTH_DLQ',
                  subjects: ['dlq.auth.event.>', 'dlq.auth.jwt.revoke'],
                  retention: RetentionPolicy.Limits,
                  storage: StorageType.File,
                  replicas: isProduction ? 3 : 1,
                  max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days
                  description: i18nService.translate(
                    'AUTH_DLQ_STREAM_DESCRIPTION',
                  ),
                },
              ],
            };
          },
        }),
        // Almost all microservices use the `settings` library,
        // but only this one microservice can write to it;
        // other microservices only read from it. Therefore, this library is maintained by `oceanchat-auth`.
        SettingsModule.register({ runSeeds: true }),
        PassportModule.register({ defaultStrategy: 'local' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          // eslint-disable-next-line @typescript-eslint/require-await
          useFactory: async (configService: ConfigService) => ({
            privateKey: configService.get<string>('jwt.accessPrivateKey'),
            publicKey: configService.get<string>('jwt.accessPublicKey'),
            signOptions: {
              expiresIn: configService.get<string>('jwt.accessExpiresIn'),
              algorithm: 'RS256',
            },
          }),
          inject: [ConfigService],
        }),
        ModelsModule.forFeature([OceanModel.Setting]),
        UsersModule,
      ],
      controllers: [OceanchatAuthController],
      providers: [
        OceanchatAuthService,
        LocalStrategy,
        LocalAuthGuard,
        // Register NatsTraceInterceptor as a global interceptor.
        {
          provide: APP_INTERCEPTOR,
          useClass: NatsTraceInterceptor,
        },
      ],
    };
  }
}
