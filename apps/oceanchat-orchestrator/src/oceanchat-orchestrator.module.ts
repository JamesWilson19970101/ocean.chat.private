import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonExceptionsModule } from '@ocean.chat/common-exceptions';
import { natsConfiguration } from '@ocean.chat/cores';
import { I18nModule } from '@ocean.chat/i18n';
import { NatsJetStreamProvisionerModule } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisModule } from '@ocean.chat/redis';
import { LoggerModule } from 'nestjs-pino';

import { NatsOrchestrateSubscriber } from './nats-orchestrate.subscriber';
import { OceanchatOrchestratorController } from './oceanchat-orchestrator.controller';
import { OceanchatOrchestratorService } from './oceanchat-orchestrator.service';

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
      serviceName: 'oceanchat-orchestrator',
      serviceInstanceId: 'default',
    }),
    NatsJetStreamProvisionerModule.forRootAsync({
      useFactory: () => ({
        natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
        streamConfigs: [],
      }),
    }),
    RedisModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('redis.host', '127.0.0.1'),
        port: configService.get<number>('redis.port', 6379),
        db: configService.get<number>('redis.db', 2),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OceanchatOrchestratorController],
  providers: [OceanchatOrchestratorService, NatsOrchestrateSubscriber],
})
export class OceanchatOrchestratorModule {}
