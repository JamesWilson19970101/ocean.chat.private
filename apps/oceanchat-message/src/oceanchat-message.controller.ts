import { Controller, Get } from '@nestjs/common';

import { OceanchatMessageService } from './oceanchat-message.service';

@Controller()
export class OceanchatMessageController {
  constructor(
    private readonly oceanchatMessageService: OceanchatMessageService,
  ) {}

  @Get()
  getHello(): string {
    return this.oceanchatMessageService.getHello();
  }
}
