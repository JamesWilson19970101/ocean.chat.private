import { Module } from '@nestjs/common';

import { OceanchatMessageController } from './oceanchat-message.controller';
import { OceanchatMessageService } from './oceanchat-message.service';

@Module({
  imports: [],
  controllers: [OceanchatMessageController],
  providers: [OceanchatMessageService],
})
export class OceanchatMessageModule {}
