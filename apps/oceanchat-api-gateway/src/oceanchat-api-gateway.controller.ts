import { Controller, Get } from '@nestjs/common';
import { OceanchatApiGatewayService } from './oceanchat-api-gateway.service';

@Controller()
export class OceanchatApiGatewayController {
  constructor(private readonly oceanchatApiGatewayService: OceanchatApiGatewayService) {}

  @Get()
  getHello(): string {
    return this.oceanchatApiGatewayService.getHello();
  }
}
