import { Module } from '@nestjs/common';

import { OceanchatAuthController } from './oceanchat-auth.controller';
import { OceanchatAuthService } from './oceanchat-auth.service';

@Module({
  imports: [],
  controllers: [OceanchatAuthController],
  providers: [OceanchatAuthService],
})
export class OceanchatAuthModule {}
