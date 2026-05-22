export interface GroupMembersRpcRequest {
  groupId: string;
}

export interface GroupMembersRpcResponse {
  groupId: string;
  memberIds: string[];
}
