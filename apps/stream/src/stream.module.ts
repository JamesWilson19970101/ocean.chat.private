import { Module } from '@nestjs/common';

import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';

@Module({
  imports: [],
  controllers: [StreamController],
  providers: [StreamService],
})
export class StreamModule {}
