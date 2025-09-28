import { DynamicModule, Module } from '@nestjs/common';

import { RedisModuleAsyncOptions, RedisModuleOptions } from './redis.interface';
import { createAsyncProviders, createProviders } from './redis.provider';
import { REDIS_CLIENT } from './redis.provider';
import { RedisService } from './redis.service';

@Module({})
export class RedisModule {
  /**
   * Register a redis module.
   * @param options The redis options.
   * @returns A dynamic module.
   */
  static register(options: RedisModuleOptions): DynamicModule {
    const providers = createProviders(options);
    return {
      module: RedisModule,
      global: true,
      providers: [...providers, RedisService],
      exports: [RedisService, REDIS_CLIENT],
    };
  }

  static registerAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const providers = createAsyncProviders(options);
    return {
      module: RedisModule,
      imports: options.imports,
      global: true,
      providers: [...providers, RedisService],
      exports: [RedisService, REDIS_CLIENT],
    };
  }
}
