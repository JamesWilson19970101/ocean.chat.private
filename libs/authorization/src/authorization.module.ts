import { Global, Module } from '@nestjs/common';

import { PermissionGuard } from './guards/permission.guard';
import { PermissionCheckerService } from './logic/permission-checker.service';
import { DiscussionValidator } from './logic/validators/discussion.validator';
import { MembershipValidator } from './logic/validators/membership.validator';
import { PublicRoomValidator } from './logic/validators/public-room.validator';
import { RoomAccessValidator } from './logic/validators/room-access.validator';
import { TeamRoomValidator } from './logic/validators/team-room.validator';
import { RoleCacheService } from './services/role-cache.service';

@Global()
@Module({
  providers: [
    PermissionCheckerService,
    RoleCacheService,
    PermissionGuard,
    DiscussionValidator,
    MembershipValidator,
    PublicRoomValidator,
    TeamRoomValidator,
    RoomAccessValidator,
  ],
  exports: [
    PermissionCheckerService,
    RoleCacheService,
    PermissionGuard,
    DiscussionValidator,
    MembershipValidator,
    PublicRoomValidator,
    TeamRoomValidator,
    RoomAccessValidator,
  ],
})
export class AuthorizationModule {}
