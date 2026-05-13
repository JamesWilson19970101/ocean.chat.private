import { Module } from '@nestjs/common';

import { MonkeyService } from './monkey.service';

@Module({
  providers: [MonkeyService],
  exports: [MonkeyService],
})
export class MonkeyModule {}
