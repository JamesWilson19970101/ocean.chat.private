import { Module } from '@nestjs/common';
import { OceanchatApiGatewayController } from './oceanchat-api-gateway.controller';
import { OceanchatApiGatewayService } from './oceanchat-api-gateway.service';

@Module({
  imports: [],
  controllers: [OceanchatApiGatewayController],
  providers: [OceanchatApiGatewayService],
})
export class OceanchatApiGatewayModule {}
