import { Controller, Get } from '@nestjs/common';

import { StreamService } from './stream.service';

@Controller()
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Get()
  getHello(): string {
    return this.streamService.getHello();
  }
}
