import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { MsgType } from '../../libs/models/message.type';

export class OrchestrateRawHeaderDto {
  @IsNumber()
  cmd: number;

  @IsNumber()
  reqId: number;
}

export class OrchestrateMsgUpDto {
  @IsString()
  @IsOptional()
  clientMsgId?: string;

  @IsString()
  groupId: string;

  @IsEnum(MsgType)
  @IsOptional()
  msgType?: MsgType;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  height?: number;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  extension?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}

export class ImOrchestrateEvent {
  @IsString()
  userId: string;

  @IsString()
  deviceId: string;

  @IsString()
  gatewayId: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrchestrateRawHeaderDto)
  rawHeader: OrchestrateRawHeaderDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrchestrateMsgUpDto)
  msgUp: OrchestrateMsgUpDto;

  @IsString()
  syncSeqId: string;
}
