import { GroupType } from '../../libs/models/groups.type';

export interface GroupMembersRpcRequest {
  groupId: string;
}

export interface GroupMembersRpcResponse {
  groupId: string;
  memberIds: string[];
}

export interface CreateRoomRpcRequest {
  type: GroupType;
  name?: string;
  members: string[];
  /**
   * User ID of the creator (propagated context from gateway)
   */
  userId: string;
}

export interface CreateRoomRpcResponse {
  groupId: string;
  type: GroupType;
  name: string;
}
