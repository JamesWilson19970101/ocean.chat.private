import { Module } from '@nestjs/common';

import { ModelsModule } from '../models.module';
import { DatabaseService } from './mongo.service';
import { UtilsService } from './utils.service';
import { DatabaseWatcher } from './watcher.service';

@Module({
  imports: [ModelsModule],
  providers: [DatabaseService, DatabaseWatcher, UtilsService],
  exports: [DatabaseService, DatabaseWatcher],
})
export class MongoModule {}
