import { IsString, IsNotEmpty } from 'class-validator';

export class SyncMessagesDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsString()
  @IsNotEmpty()
  syncSeqId: string;
}

export interface SyncMessageItem {
  clientMsgId: string;
  groupId: string;
  msgType: number;
  content?: string;
  url?: string;
  width?: number;
  height?: number;
  size?: string;
  format?: string;
  duration?: number;
  fileName?: string;
  extension?: string;
  thumbnailUrl?: string;
  syncSeqId: string;
  senderId: string;
  createdAt: string;
}

export interface SyncMessagesResponse {
  messages: SyncMessageItem[];
  hasMore: boolean;
}
