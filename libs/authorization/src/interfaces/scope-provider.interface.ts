/**
 * @fileoverview
 * Scope Data Provider Interface.
 *
 * This is the bridge between the generic Authorization Library and specific microservices.
 *
 * Problem: The Auth Lib knows "how" to check permissions, but it doesn't have access
 * to business data (e.g., it doesn't know if User A is an Owner of Room B).
 *
 * Solution: The microservice (e.g., Group Service) must implement this interface
 * and inject it into the AuthorizationModule to provide context-aware role data.
 */

export abstract class IScopeDataProvider {
  /**
   * Retrieves the roles a user holds within a specific scope (e.g., a Room).
   *
   * @param userId - The ID of the user.
   * @param scopeId - The ID of the scope (e.g., roomId).
   * @returns A list of role names (e.g., ['owner', 'moderator']) or an empty array.
   */
  abstract getScopedRoles(userId: string, scopeId: string): Promise<string[]>;
}
