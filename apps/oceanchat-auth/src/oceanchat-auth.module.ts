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
            const environment = isProduction
              ? i18nService.translate('ENVIRONMENT_PRODUCTION')
              : i18nService.translate('ENVIRONMENT_DEVELOPMENT');
            return {
              // NATS server URL, configurable via environment variables.
              natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
              streamConfig: {
                // The unique name for the Stream.
                name: 'AUTH',
                // Capture all subjects starting with 'auth.' to aggregate all auth-related messages.
                subjects: ['auth.event.>'],
                // Retention policy: 'Limits' for production (for auditing/replay), 'Workqueue' for development (for efficiency).
                retention: isProduction
                  ? RetentionPolicy.Limits
                  : RetentionPolicy.Workqueue,
                // Persist messages to disk to ensure no data loss.
                storage: StorageType.File,
                // Number of replicas for high availability: 3 recommended for a production cluster, 1 for a single-node dev environment.
                replicas: isProduction ? 3 : 1,
                // In production, retain messages for 24 hours even after consumption. 0 means no time limit.
                max_age: isProduction ? 24 * 60 * 60 * 1_000_000_000 : 0, // 24 hours in nanoseconds
                // Provide a human-readable description for the stream for easier operations.
                description: i18nService.translate('NATS_STREAM_DESCRIPTION', {
                  serviceName: 'oceanchat-auth',
                  environment,
                }),
              },
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
            secret: configService.get<string>('jwt.accessSecret'),
            signOptions: {
              expiresIn: configService.get<string>('jwt.accessExpiresIn'),
            },
          }),
          inject: [ConfigService],
        }),
        ModelsModule.forFeature([OceanModel.Setting, OceanModel.User]),
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
