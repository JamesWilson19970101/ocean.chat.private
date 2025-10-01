import { Module } from '@nestjs/common';

import { OceanchatGatewayController } from './oceanchat-gateway.controller';
import { OceanchatGatewayService } from './oceanchat-gateway.service';

@Module({
  imports: [],
  controllers: [OceanchatGatewayController],
  providers: [OceanchatGatewayService],
})
export class OceanchatGatewayModule {}
