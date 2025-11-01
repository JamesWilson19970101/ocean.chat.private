import { Module } from '@nestjs/common';

import { OceanchatUserController } from './oceanchat-user.controller';
import { OceanchatUserService } from './oceanchat-user.service';

@Module({
  imports: [],
  controllers: [OceanchatUserController],
  providers: [OceanchatUserService],
})
export class OceanchatUserModule {}
