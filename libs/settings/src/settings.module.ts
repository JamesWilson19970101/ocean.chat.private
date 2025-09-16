import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';

import { SettingsService } from './settings.service';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single', // TODO: make this configurable for cluster in production.
        url: `redis://${configService.get<string>('redis.host')}:${configService.get<number>('redis.port')}`,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
