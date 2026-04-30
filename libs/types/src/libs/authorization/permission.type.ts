// Defines the relationship between a permission and its default roles
export interface IPermissionDefinition {
  /**
   * The unique ID of the permission (e.g., 'create-c', 'assign-roles')
   */
  _id: string;
  /**
   * The list of role names that have this permission by default.
   */
  roles: string[];
}

export interface IAuthenticatedRequest {
  user: {
    sub: string;
    username: string;
  };

  query: Record<string, any>;

  params: Record<string, any>;

  body: Record<string, any>;
}
