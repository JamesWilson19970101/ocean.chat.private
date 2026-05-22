import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import { databaseConfiguration, natsConfiguration } from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { ModelsModule, OceanModel } from '@ocean.chat/models';
import { LoggerModule } from 'nestjs-pino';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { NatsOrchestrateSubscriber } from './nats-orchestrate.subscriber';
import { OceanchatMessagePersistenceWorkerController } from './oceanchat-message-persistence-worker.controller';
import { OceanchatMessagePersistenceWorkerService } from './oceanchat-message-persistence-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [natsConfiguration, databaseConfiguration],
      isGlobal: true,
    }),
    I18nModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    CommonExceptionsModule.forRoot({
      serviceName: 'oceanchat-message-persistence-worker',
      serviceInstanceId: 'default',
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
  controllers: [OceanchatMessagePersistenceWorkerController],
  providers: [
    OceanchatMessagePersistenceWorkerService,
    NatsOrchestrateSubscriber,
  ],
})
export class OceanchatMessagePersistenceWorkerModule {}
