import { Controller, Get } from '@nestjs/common';

import { OceanchatRouterService } from './oceanchat-router.service';

@Controller()
export class OceanchatRouterController {
  constructor(
    private readonly oceanchatRouterService: OceanchatRouterService,
  ) {}

  @Get()
  getHello(): string {
    return this.oceanchatRouterService.getHello();
  }
}
