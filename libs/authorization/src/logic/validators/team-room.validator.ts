import { Injectable, Optional } from '@nestjs/common';
import {
  IRoomContext,
  IRoomValidator,
  ITeamDataProvider,
} from '@ocean.chat/types';

import { PermissionId } from '../../constants/permission-ids';
import { PermissionCheckerService } from '../permission-checker.service';

/**
 * Validates access to Rooms that belong to a Team.
 */
@Injectable()
export class TeamRoomValidator implements IRoomValidator {
  constructor(
    private readonly permissionChecker: PermissionCheckerService,
    @Optional() private readonly teamProvider?: ITeamDataProvider,
  ) {}

  async validate(userId: string, room: IRoomContext): Promise<boolean> {
    // Logic: Must be a Public Channel ('c') AND belong to a Team
    if (!room || !room.teamId || room.t !== 'c') {
      return false;
    }

    if (!this.teamProvider) {
      // Without team provider, we cannot validate team rules. Fail safe.
      return false;
    }
    // Get Team Type
    const teamType = await this.teamProvider.getTeamType(room.teamId);

    // If Team is Public -> Check if user has permission to view public rooms
    if (teamType === 'PUBLIC') {
      return this.permissionChecker.hasPermission(
        userId,
        PermissionId.VIEW_C_ROOM,
      );
    }

    // If Team is Private (or other) -> User MUST be a member of the Team
    if (userId) {
      return this.teamProvider.isTeamMember(userId, room.teamId);
    }

    return false;
  }
}
