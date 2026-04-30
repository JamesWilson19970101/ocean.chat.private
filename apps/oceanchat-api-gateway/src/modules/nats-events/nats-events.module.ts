import { Module } from '@nestjs/common';

import { NatsEventsService } from './nats-events.service';

@Module({
  providers: [NatsEventsService],
})
export class NatsEventsModule {}
