import { Module } from '@nestjs/common';
import { ModelsModule } from '@ocean.chat/models';

import { SettingsService } from './settings.service';

@Module({
  imports: [ModelsModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
