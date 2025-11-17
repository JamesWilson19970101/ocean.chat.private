import { Module } from '@nestjs/common';

import { OceanchatGroupController } from './oceanchat-group.controller';
import { OceanchatGroupService } from './oceanchat-group.service';

@Module({
  imports: [],
  controllers: [OceanchatGroupController],
  providers: [OceanchatGroupService],
})
export class OceanchatGroupModule {}
