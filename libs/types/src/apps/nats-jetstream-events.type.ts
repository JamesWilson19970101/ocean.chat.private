import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Payload for the 'presence.conn.online' event.
 */

export interface PresenceOnlineEvent {
  userId: string;
  deviceId: string;
  deviceType: string;
  gatewayId: string;
  timestamp: string;
}
export class PresenceOnlineEventDto {
  @IsString()
  userId: string;

  @IsString()
  deviceId: string;

  @IsString()
  deviceType: string;

  @IsString()
  gatewayId: string;

  @IsString()
  timestamp: string;
}

/**
 * Payload for the 'presence.conn.offline' event.
 */
export interface PresenceOfflineEvent {
  userId: string;
  deviceId: string;
  gatewayId: string;
  timestamp: string;
}
export class PresenceOfflineEventDto {
  @IsString()
  userId: string;

  @IsString()
  deviceId: string;

  @IsString()
  gatewayId: string;

  @IsString()
  timestamp: string;
}

/**
 * Payload for the 'presence.conn.heartbeat' event.
 */
export class PresenceHeartbeatEventDto {
  @IsString()
  userId: string;

  @IsString()
  deviceId: string;

  @IsString()
  gatewayId: string;
}

/** playload for the im.up.> */
export interface RawHeader {
  cmd: number;
  reqId: number;
}

export interface ImUpEnvelope {
  userId?: string;
  deviceId?: string;
  gatewayId: string;
  connectionId?: string;
  rawHeader: RawHeader;
  payload: string; // Base64 encoded Protobuf payload
}

export class RawHeaderDto {
  @IsNumber()
  cmd: number;

  @IsNumber()
  reqId: number;
}

export class ImUpEnvelopeDto {
  @IsString()
  @IsOptional()
  userId?: string;

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
  @Type(() => RawHeaderDto)
  rawHeader: RawHeaderDto;

  @IsString()
  payload: string; // Base64 encoded Protobuf payload
}

export class ImDownboundEventDto {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsNumber()
  cmd: number;

  @IsString()
  payload: string; // Base64 encoded Protobuf payload

  @IsNumber()
  @IsOptional()
  reqId?: number;
}

export class SyncCursorReadEventDto {
  @IsString()
  userId: string;

  @IsString()
  groupId: string;

  @IsString()
  syncSeqId: string;
}

/** playload for auth.jwt.revoke */
export class TokenRevokedEvent {
  @IsString()
  jti: string;

  @IsNumber()
  exp: number;
}

/** payload for auth.event.user.loggedIn */
export class UserLoggedInEvent {
  @IsString()
  userId: string;

  @IsString()
  deviceId: string;

  @IsDateString()
  loginTime: string;
}
