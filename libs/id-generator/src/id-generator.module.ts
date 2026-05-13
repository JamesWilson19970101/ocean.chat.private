import { Module } from '@nestjs/common';
import { ModelsModule, OceanModel } from '@ocean.chat/models';
import { RedisModule } from '@ocean.chat/redis';

import { IdGeneratorService } from './id-generator.service';

@Module({
  imports: [RedisModule, ModelsModule.forFeature([OceanModel.Sequence])],
  providers: [IdGeneratorService],
  exports: [IdGeneratorService],
})
export class IdGeneratorModule {}
