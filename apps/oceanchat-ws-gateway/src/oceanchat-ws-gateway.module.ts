import { Module } from '@nestjs/common';
import { OceanchatWsGatewayController } from './oceanchat-ws-gateway.controller';
import { OceanchatWsGatewayService } from './oceanchat-ws-gateway.service';

@Module({
  imports: [],
  controllers: [OceanchatWsGatewayController],
  providers: [OceanchatWsGatewayService],
})
export class OceanchatWsGatewayModule {}
