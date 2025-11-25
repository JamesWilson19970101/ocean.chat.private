/**
 * Defines the scope of a role.
 * - 'Users': Global role assigned to a user.
 * - 'Subscriptions': Scoped role, assigned to a user within a specific room/group.
 */
export type TRoleScope = 'Users' | 'Subscriptions';

// Defines the structure for a default role definition
export interface IDefaultRole {
  /**
   * The unique name of the role (e.g., 'admin', 'user', 'owner')
   */
  name: string;
  /**
   * The scope of the role.
   */
  scope: TRoleScope;
  /**
   * A brief description of the role's purpose.
   */
  description: string;
}

/**
 * @fileoverview
 * Role Data Source Interface (The "Fetcher" Strategy).
 *
 * This abstract class allows the RoleCacheService to remain agnostic of the
 * underlying database (MongoDB/Postgres).
 *
 * The host application (e.g., oceanchat-auth) MUST provide an implementation
 * of this provider to allow the cache service to "refill" itself on cache misses.
 */
export abstract class IRoleDataSource {
  /**
   * Fetches the global roles for a user from the source of truth (DB).
   */
  abstract getUserGlobalRoles(userId: string): Promise<string[]>;

  /**
   * Fetches the roles associated with a permission from the source of truth (DB).
   */
  abstract getRolesForPermission(permissionId: string): Promise<string[]>;
}
