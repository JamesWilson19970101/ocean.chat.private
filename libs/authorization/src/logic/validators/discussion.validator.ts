import { forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import {
  IRoomContext,
  IRoomDataProvider,
  IRoomValidator,
} from '@ocean.chat/types';

import { RoomAccessValidator } from './room-access.validator';

@Injectable()
export class DiscussionValidator implements IRoomValidator {
  constructor(
    // Use forwardRef because RoomAccessValidator uses DiscussionValidator (Circular dependency)
    @Inject(forwardRef(() => RoomAccessValidator))
    private readonly roomAccessValidator: RoomAccessValidator,
    @Optional() private readonly roomDataProvider?: IRoomDataProvider,
  ) {}

  async validate(userId: string, room: IRoomContext): Promise<boolean> {
    // Logic: Must have a parent room ID (prid)
    if (!room || !room.prid) {
      return false;
    }

    if (!this.roomDataProvider) {
      return false;
    }

    // Fetch Parent Room Context
    const parentRoom = await this.roomDataProvider.getRoomContext(room.prid);
    if (!parentRoom) {
      return false;
    }

    // Recursive Check: Can user access the parent room?
    return this.roomAccessValidator.canAccess(userId, parentRoom);
  }
}
