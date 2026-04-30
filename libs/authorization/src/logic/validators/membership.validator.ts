import { Injectable, Optional } from '@nestjs/common';
import {
  IRoomContext,
  IRoomValidator,
  IScopeDataProvider,
} from '@ocean.chat/types';

import { PermissionId, PermissionIdType } from '../../constants/permission-ids';
import { PermissionCheckerService } from '../permission-checker.service';

/**
 * Validate access based on Membership
 * Logic: If user is already a member of a room -> check 'view-joined-room' -> Check specific room type permission
 *
 * Note: "Being a member" usually means you have a subscription doccument
 * I use IScopeDataProvider to check if the user has ANY roles in this room
 * If getScopedRoles returns non-empty array (e.g. ['owner'] or even ['member']),
 * it implies membership.
 */
@Injectable()
export class MembershipValidator implements IRoomValidator {
  constructor(
    private readonly permissionChecker: PermissionCheckerService,
    @Optional() private readonly scopeDataProvider?: IScopeDataProvider,
  ) {}

  async validate(userId: string, room: IRoomContext): Promise<boolean> {
    if (!this.scopeDataProvider) {
      return false; // Cannot check membership without provider
    }

    // Check if user is effectively in the room (has roles)
    const roles = await this.scopeDataProvider.getScopedRoles(userId, room._id);
    const isMember = roles.length > 0;

    if (!isMember) {
      return false;
    }

    // Check 'view-joined-room' (Priority)
    if (
      await this.permissionChecker.hasPermission(
        userId,
        PermissionId.VIEW_JOINED_ROOM,
      )
    ) {
      return true;
    }

    // Fallback: Check specific room type permission
    const typePermission = this.getTypePermission(
      room.t,
    ) as PermissionIdType | null;
    if (
      typePermission &&
      (await this.permissionChecker.hasPermission(userId, typePermission))
    ) {
      return true;
    }

    return false;
  }

  private getTypePermission(type: string): string | null {
    switch (type) {
      case 'c':
        return PermissionId.VIEW_C_ROOM;
      case 'p':
        return PermissionId.VIEW_P_ROOM;
      case 'd':
        return PermissionId.VIEW_D_ROOM;
      default:
        return null;
    }
  }
}
