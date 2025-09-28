import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { SettingsService } from '@ocean.chat/settings';

import { UpdateSettingDto } from './dtos/update-setting.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':key')
  async findOne(@Param('key') key: string) {
    // The service should handle cases where the key is not found.
    return this.settingsService.getSettingValue(key);
  }

  @Post()
  @ApiBody({ type: UpdateSettingDto })
  async upsert(@Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.setSettingValue(
      updateSettingDto.key,
      updateSettingDto.value,
    );
  }
}
