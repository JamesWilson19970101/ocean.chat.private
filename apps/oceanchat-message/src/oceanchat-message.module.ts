import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import { natsConfiguration } from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { IdGeneratorModule } from '@ocean.chat/id-generator';
import { MonkeyModule } from '@ocean.chat/monkey';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { LoggerModule } from 'nestjs-pino';

import { NatsImRouteSubscriber } from './nats-im-route.subscriber';
import { OceanchatMessageController } from './oceanchat-message.controller';
import { OceanchatMessageService } from './oceanchat-message.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [natsConfiguration],
      isGlobal: true,
    }),
    I18nModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    CommonExceptionsModule.forRoot({
      serviceName: 'oceanchat-message',
      serviceInstanceId: 'default',
    }),
    NatsJetStreamProvisionerModule.forRootAsync({
      useFactory: () => ({
        natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
        streamConfigs: [], // Configured by auth service initially
      }),
    }),
    MonkeyModule,
    IdGeneratorModule,
  ],
  controllers: [OceanchatMessageController],
  providers: [OceanchatMessageService, NatsImRouteSubscriber],
})
export class OceanchatMessageModule {}
