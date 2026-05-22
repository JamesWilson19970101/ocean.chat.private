import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import { natsConfiguration } from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { LoggerModule } from 'nestjs-pino';

import { NatsOfflinePushSubscriber } from './nats-offline-push.subscriber';
import { OceanchatPusherOfflineController } from './oceanchat-pusher-offline.controller';
import { OceanchatPusherOfflineService } from './oceanchat-pusher-offline.service';

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
      serviceName: 'oceanchat-pusher-offline',
      serviceInstanceId: 'default',
    }),
    NatsJetStreamProvisionerModule.forRootAsync({
      useFactory: () => ({
        natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
        streamConfigs: [],
      }),
    }),
  ],
  controllers: [OceanchatPusherOfflineController],
  providers: [OceanchatPusherOfflineService, NatsOfflinePushSubscriber],
})
export class OceanchatPusherOfflineModule {}
