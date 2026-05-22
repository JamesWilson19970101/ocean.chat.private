import { MsgUp } from '@ocean.chat/monkey';

import { RawHeader } from '../nats-jetstream-events.type';

export interface ImRouteEnvelope {
  userId: string; // Guaranteed to exist after routing/auth checks
  deviceId?: string;
  gatewayId: string;
  connectionId?: string;
  rawHeader: RawHeader;
  msgUp: MsgUp; // Decoded Protobuf message
}
