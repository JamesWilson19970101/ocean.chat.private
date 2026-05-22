import { Controller, Get } from '@nestjs/common';

@Controller()
export class OceanchatWsGatewayController {
  // Although this is a pure WS microservice, retaining a stateless HTTP health check endpoint is very useful for orchestration
  @Get('health')
  healthCheck(): { status: string; timestamp: string } {
    return { status: 'UP', timestamp: new Date().toISOString() };
  }
}
