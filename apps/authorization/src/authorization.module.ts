import { Module } from '@nestjs/common';
import { ModelsModule } from '@ocean.chat/models';

import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, ModelsModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
})
export class AuthorizationModule {}
