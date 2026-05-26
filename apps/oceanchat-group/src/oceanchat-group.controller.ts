import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateRoomRpcRequest, CreateRoomRpcResponse } from '@ocean.chat/types';

import { OceanchatGroupService } from './oceanchat-group.service';

@Controller()
export class OceanchatGroupController {
  constructor(private readonly groupService: OceanchatGroupService) {}

  @MessagePattern('group.cmd.create')
  async createGroup(
    @Payload() payload: CreateRoomRpcRequest,
  ): Promise<CreateRoomRpcResponse> {
    return this.groupService.createGroup(payload);
  }
}
