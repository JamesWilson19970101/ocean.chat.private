export enum MsgType {
  TEXT = 0,
  IMAGE = 1,
  AUDIO = 2,
  FILE = 3,
  UNRECOGNIZED = -1,
}

/** MSG_UP: Client -> Server message */
export interface MsgUpType {
  clientMsgId?: string;
  groupId: string;
  msgType?: MsgType;
  /** TEXT */
  content?: string;
  /** MEDIA */
  url?: string;
  width?: number;
  height?: number;
  size?: string;
  format?: string;
  duration?: number;
  fileName?: string;
  extension?: string;
  thumbnailUrl?: string;
}
