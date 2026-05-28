import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateRoomRpcRequest,
  CreateRoomRpcResponse,
  GroupType,
} from '@ocean.chat/types';

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

  @MessagePattern('group.query.members')
  async getGroupMembers(
    @Payload() payload: { groupId: string },
  ): Promise<string[]> {
    return this.groupService.getGroupMemberIds(payload.groupId);
  }

  @MessagePattern('group.query.userGroups')
  async getUserGroups(
    @Payload() payload: { userId: string },
  ): Promise<{ type: GroupType; name: string; groupId: string }[]> {
    return this.groupService.getUserGroups(payload.userId);
  }
}
