import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { OceanchatApiGatewayController } from './oceanchat-api-gateway.controller';
import { OceanchatApiGatewayService } from './oceanchat-api-gateway.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: ['nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [OceanchatApiGatewayController],
  providers: [OceanchatApiGatewayService],
})
export class OceanchatApiGatewayModule {}
