import { Injectable } from '@nestjs/common';
import { IRoomContext, IRoomValidator } from '@ocean.chat/types';

import { PermissionId } from '../../constants/permission-ids';
import { PermissionCheckerService } from '../permission-checker.service';

/**
 * Validates access to Public Channels ('c').
 * Logic: If room is public AND user has 'view-c-room' permission -> Allow.
 */
@Injectable()
export class PublicRoomValidator implements IRoomValidator {
  constructor(private readonly permissionChecker: PermissionCheckerService) {}
  async validate(userId: string, room: IRoomContext): Promise<boolean> {
    // This validator only applies to public channels (type 'c') that do not belong to a team.
    if (!room || room.t !== 'c' || room.teamId) {
      return false;
    }

    // Logic: User must have global 'view-c-room' permission
    return this.permissionChecker.hasPermission(
      userId,
      PermissionId.VIEW_C_ROOM,
    );
  }
}
