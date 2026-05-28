import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SyncMessagesDto, SyncMessagesResponse } from '@ocean.chat/types';

import { OceanchatQueryService } from './oceanchat-query.service';

export interface InternalSyncMessagesDto extends SyncMessagesDto {
  userId: string;
}

@Controller()
export class OceanchatQueryController {
  constructor(private readonly oceanchatQueryService: OceanchatQueryService) {}

  @MessagePattern('query.messages.sync')
  async syncMessages(
    @Payload() payload: InternalSyncMessagesDto,
  ): Promise<SyncMessagesResponse> {
    return this.oceanchatQueryService.syncMessages(
      payload.groupId,
      payload.syncSeqId,
      payload.userId,
    );
  }
}
