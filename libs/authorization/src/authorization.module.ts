import { Global, Module } from '@nestjs/common';

import { PermissionGuard } from './guards/permission.guard';
import { PermissionCheckerService } from './logic/permission-checker.service';
import { RoleCacheService } from './services/role-cache.service';

@Global()
@Module({
  providers: [PermissionCheckerService, RoleCacheService, PermissionGuard],
  exports: [PermissionCheckerService, RoleCacheService, PermissionGuard],
})
export class AuthorizationModule {}
