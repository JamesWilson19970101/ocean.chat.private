import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WATCHED_COLLECTION_TOKEN } from '../interfaces';
import { ModelsModule } from '../models.module';
import { UtilsService } from './utils.service';
import { DatabaseWatcher } from './watcher.service';

@Module({
  imports: [ModelsModule, ConfigModule],
  providers: [DatabaseWatcher, UtilsService],
  exports: [DatabaseWatcher],
})
export class MongoModule {
  static register(collectionsToWatch: string[] = []): DynamicModule {
    return {
      module: MongoModule,
      providers: [
        {
          provide: WATCHED_COLLECTION_TOKEN,
          useValue: collectionsToWatch,
        },
      ],
      // No need to re-export providers as they are part of the base module
    };
  }
}
