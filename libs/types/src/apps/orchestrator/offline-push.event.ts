import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum VendorType {
  APNS = 'apns',
  FCM = 'fcm',
  HUAWEI = 'huawei',
  XIAOMI = 'xiaomi',
  VIVO = 'vivo',
  OPPO = 'oppo',
}

export class OfflinePushEvent {
  @IsString()
  userId: string;

  @IsString()
  groupId: string;

  @IsEnum(VendorType)
  vendor: VendorType;

  @IsString()
  deviceToken: string;

  @IsString()
  syncSeqId: string;

  @IsString()
  @IsOptional()
  collapseKey?: string;

  @IsNumber()
  @IsOptional()
  badge?: number;
}
