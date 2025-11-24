import { Injectable } from '@nestjs/common';
import { IRoomContext, IRoomValidator } from '@ocean.chat/types';

import { MembershipValidator } from './membership.validator';
import { PublicRoomValidator } from './public-room.validator';
import { TeamRoomValidator } from './team-room.validator';

/**
 * @fileoverview
 * Composite Validator for Room Access.
 *
 * Implements the "Chain of Responsibility" or "Strategy" pattern.
 * It iterates through multiple validators. If ANY validator returns true, access is GRANTED.
 *
 * Usage:
 * In Group Service, before returning a room or message, call:
 * `await this.roomAccessValidator.canAccess(userId, room)`
 */
@Injectable()
export class RoomAccessValidator {
  private validators: IRoomValidator[];
  constructor(
    private readonly publicRoomValidator: PublicRoomValidator,
    private readonly teamRoomValidator: TeamRoomValidator,
    private readonly membershipValidator: MembershipValidator,
  ) {
    // Order matters: Check cheapest/most common rules first
    this.validators = [
      this.teamRoomValidator, // 1. Check Team logic (complex hierarchy)
      this.publicRoomValidator, // 2. Check Public logic (simple)
      this.membershipValidator, // 3. Check Membership (db query)
    ];
  }

  /**
   * Determines if a user can access a specific room.
   */
  async canAccess(userId: string, room: IRoomContext): Promise<boolean> {
    if (!userId || !room) {
      return false;
    }
    // TODO: Check if user has 'view-other-user-channels' (Super Admin override)
    // This could be a separate validator or added here.
    for (const validator of this.validators) {
      if (await validator.validate(userId, room)) {
        return true;
      }
    }
    return false;
  }
}
