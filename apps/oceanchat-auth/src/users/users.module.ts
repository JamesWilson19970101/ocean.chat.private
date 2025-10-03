import { Module } from '@nestjs/common';
import { ModelsModule } from '@ocean.chat/models';
import { SettingsModule } from '@ocean.chat/settings';

import { PasswordService } from './password.service';
// import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ModelsModule, SettingsModule],
  // controllers: [UsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
