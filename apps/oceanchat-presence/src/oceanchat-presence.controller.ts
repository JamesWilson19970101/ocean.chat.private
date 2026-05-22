import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class OceanchatPresenceController {
  // Microservice RPC Endpoint for Health Checks
  @MessagePattern('presence.ping')
  ping(): string {
    return 'PONG';
  }
}
