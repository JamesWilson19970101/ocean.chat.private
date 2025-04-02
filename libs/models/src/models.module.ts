import { Module } from '@nestjs/common';

import { ModelsService } from './models.service';

@Module({
  providers: [],
  exports: [ModelsService],
})
export class ModelsModule {}
