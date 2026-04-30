import { Controller, Get } from '@nestjs/common';

import { OceanchatWsGatewayService } from './oceanchat-ws-gateway.service';

@Controller()
export class OceanchatWsGatewayController {
  constructor(
    private readonly oceanchatWsGatewayService: OceanchatWsGatewayService,
  ) {}

  @Get()
  getHello(): string {
    return this.oceanchatWsGatewayService.getHello();
  }
}
