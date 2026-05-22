import { Controller, Get } from '@nestjs/common';

import { OceanchatPusherRealtimeService } from './oceanchat-pusher-realtime.service';

@Controller()
export class OceanchatPusherRealtimeController {
  constructor(
    private readonly oceanchatPusherRealtimeService: OceanchatPusherRealtimeService,
  ) {}

  @Get()
  getHello(): string {
    return this.oceanchatPusherRealtimeService.getHello();
  }
}
