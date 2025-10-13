import { Module } from '@nestjs/common';

import { TracingService } from './tracing.service';

@Module({
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}
