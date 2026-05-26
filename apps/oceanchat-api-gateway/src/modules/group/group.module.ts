import { Module } from '@nestjs/common';

import { GroupController } from './group.controller';

@Module({
  controllers: [GroupController],
  providers: [],
})
export class GroupModule {}
