import { Module } from '@nestjs/common';

import { OceanchatPusherRealtimeController } from './oceanchat-pusher-realtime.controller';
import { OceanchatPusherRealtimeService } from './oceanchat-pusher-realtime.service';

@Module({
  imports: [],
  controllers: [OceanchatPusherRealtimeController],
  providers: [OceanchatPusherRealtimeService],
})
export class OceanchatPusherRealtimeModule {}
