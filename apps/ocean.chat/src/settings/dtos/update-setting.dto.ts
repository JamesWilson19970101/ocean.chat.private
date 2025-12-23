import { ApiProperty } from '@nestjs/swagger';
import type { SettingValue } from '@ocean.chat/types';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({ description: 'The key of the setting', example: 'site_name' })
  @IsString()
  @IsNotEmpty()
  readonly key: string;

  @ApiProperty({ example: 'Ocean Chat' })
  @IsNotEmpty()
  readonly value: SettingValue;
}
