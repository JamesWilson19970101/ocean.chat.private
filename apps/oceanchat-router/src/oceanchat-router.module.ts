import { Module } from '@nestjs/common';

import { OceanchatRouterController } from './oceanchat-router.controller';
import { OceanchatRouterService } from './oceanchat-router.service';

@Module({
  imports: [],
  controllers: [OceanchatRouterController],
  providers: [OceanchatRouterService],
})
export class OceanchatRouterModule {}
