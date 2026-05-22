import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class RouteRawHeaderDto {
  @IsNumber()
  cmd: number;

  @IsNumber()
  reqId: number;
}

export class RouteMsgUpDto {
  @IsString()
  clientMsgId: string;

  @IsString()
  groupId: string;

  @IsNumber()
  msgType: number;

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

export class ImRouteEvent {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  gatewayId: string;

  @IsString()
  @IsOptional()
  connectionId?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => RouteRawHeaderDto)
  rawHeader: RouteRawHeaderDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => RouteMsgUpDto)
  msgUp: RouteMsgUpDto;
}
