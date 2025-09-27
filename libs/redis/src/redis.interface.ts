import { ModuleMetadata } from '@nestjs/common';
import { RedisOptions } from 'ioredis';

export type RedisModuleOptions = RedisOptions;

export interface RedisModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;

  inject?: any[];
}
