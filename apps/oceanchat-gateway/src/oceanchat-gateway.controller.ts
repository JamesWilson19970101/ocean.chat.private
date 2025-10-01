import { Controller, Get } from '@nestjs/common';

import { OceanchatGatewayService } from './oceanchat-gateway.service';

@Controller()
export class OceanchatGatewayController {
  constructor(
    private readonly oceanchatGatewayService: OceanchatGatewayService,
  ) {}

  @Get()
  getHello(): string {
    return this.oceanchatGatewayService.getHello();
  }
}
