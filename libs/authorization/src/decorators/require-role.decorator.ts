import { SetMetadata } from '@nestjs/common';

import { ROLES_METADATA_KEY } from '../constants/metadata-keys';

/**
 * Decorator to enforce role requirements.
 *
 * Note: In a fine-grained RBAC system like Ocean Chat, it is generally recommended
 * to use @RequirePermission instead of checking for roles directly.
 * However, this is useful for top-level administrative locks (e.g., strictly 'admin' only).
 *
 * @usage
 * @RequireRole('admin')
 * async deleteSystem() { ... }
 *
 * @param roles - One or more role names required.
 */
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
