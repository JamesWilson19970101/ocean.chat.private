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
