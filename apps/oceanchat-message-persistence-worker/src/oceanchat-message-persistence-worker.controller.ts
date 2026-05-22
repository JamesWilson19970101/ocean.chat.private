import { Controller, Get } from '@nestjs/common';

@Controller()
export class OceanchatMessagePersistenceWorkerController {
  @Get('health')
  healthCheck(): { status: string; timestamp: string } {
    return { status: 'UP', timestamp: new Date().toISOString() };
  }
}
