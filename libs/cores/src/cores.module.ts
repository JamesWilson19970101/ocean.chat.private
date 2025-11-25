import { Module } from '@nestjs/common';

import { CoresService } from './cores.service';

@Module({
  providers: [CoresService],
  exports: [CoresService],
})
export class CoresModule {}
