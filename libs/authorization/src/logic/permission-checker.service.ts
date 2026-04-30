import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { IScopeDataProvider } from '@ocean.chat/types';

import { PermissionIdType } from '../constants/permission-ids';
import { RoleCacheService } from '../services/role-cache.service';

@Injectable()
export class PermissionCheckerService {
  constructor(
    private readonly roleCache: RoleCacheService,
    private readonly i18nService: I18nService,
    // The ScopeProvider is optional. If the consuming microservice (e.g. API Gateway)
    // doesn't deal with rooms, it won't provide one.
    @Optional() private readonly scopeProvider?: IScopeDataProvider,
  ) {}

  /**
   * Checks if a user has a specific permission.
   *
   * @param userId - The user ID.
   * @param permissionId - The permission ID to check.
   * @param scopeId - (Optional) Context ID, e.g., roomId.
   */
  async hasPermission(
    userId: string,
    permissionId: PermissionIdType | null,
    scopeId?: string,
  ): Promise<boolean> {
    if (!userId || !permissionId) {
      return false;
    }
    // Get all roles the user possesses in this context
    const userRoles = await this.getEffectiveRoles(userId, scopeId);

    // Get all roles that are allowed to perform this action
    const allowedRoles =
      await this.roleCache.getRolesForPermission(permissionId);

    return userRoles.some((role) => allowedRoles.includes(role));
  }

  /**
   * Checks if a user has ALL permissions in the list.
   */
  async hasAllPermissions(
    userId: string,
    permissions: PermissionIdType[],
    scopeId?: string,
  ): Promise<boolean> {
    if (!userId || permissions.length === 0) {
      return false;
    }

    // Parallel Fetch: User roles + Rules for ALL requested permissions
    const [userRoles, ...permissionsRolesList] = await Promise.all([
      this.getEffectiveRoles(userId, scopeId),
      ...permissions.map((p) => this.roleCache.getRolesForPermission(p)),
    ]);

    if (userRoles.length === 0) {
      return false;
    }
    // Optimization: Convert user roles to Set for O(1) lookup
    const userRolesSet = new Set(userRoles);

    // Memory Check: Verify every permission allows at least one of the user's roles
    return permissionsRolesList.every((allowedRoles) =>
      allowedRoles.some((role) => userRolesSet.has(role)),
    );
  }

  /**
   * Checks if a user has AT LEAST ONE permission in the list (OR logic).
   */
  async hasAtLeastOnePermission(
    userId: string,
    permissions: PermissionIdType[],
    scopeId?: string,
  ): Promise<boolean> {
    if (!userId || permissions.length === 0) {
      return false;
    }

    // Parallel Fetch
    const [userRoles, ...permissionsRolesList] = await Promise.all([
      this.getEffectiveRoles(userId, scopeId),
      ...permissions.map((p) => this.roleCache.getRolesForPermission(p)),
    ]);

    if (userRoles.length === 0) {
      return false;
    }

    const userRolesSet = new Set(userRoles);

    // Memory Check: Verify if ANY permission is satisfied
    return permissionsRolesList.some((allowedRoles) =>
      allowedRoles.some((role) => userRolesSet.has(role)),
    );
  }

  /**
   * Helper: Aggregates Global Roles + Scoped Roles.
   */
  private async getEffectiveRoles(
    userId: string,
    scopeId?: string,
  ): Promise<string[]> {
    // Always fetch global roles
    const globalRoles = await this.roleCache.getUserGlobalRoles(userId);

    // If no scope provided, or no provider available, return global only
    if (!scopeId || !this.scopeProvider) {
      return globalRoles;
    }

    // Fetch scoped roles (e.g. 'owner', 'moderator' in a room)
    try {
      const scopedRoles = await this.scopeProvider.getScopedRoles(
        userId,
        scopeId,
      );
      // Merge and deduplicate (Set handles deduplication)
      return [...new Set([...globalRoles, ...scopedRoles])];
    } catch (error) {
      throw new BaseRpcException(
        this.i18nService.translate('FAILED_TO_RETRIEVE_SCOPED_ROLES'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.FAILED_TO_FETCH_SCOPED_ROLES,
        { cause: error },
      );
    }
  }
}
