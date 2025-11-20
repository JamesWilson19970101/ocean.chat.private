import { SetMetadata } from '@nestjs/common';

import { PERMISSIONS_METADATA_KEY } from '../constants/metadata-keys';
import { PermissionIdType } from '../constants/permission-ids';

/**
 * Decorator to enforce permission requirements on a Controller or a Method.
 *
 * @usage
 * // On a method
 * @RequirePermission(PermissionId.VIEW_HISTORY)
 * async getHistory() { ... }
 *
 * // Requiring multiple permissions (Guard typically implements this as "Require ALL" or "Require ANY" depending on logic, strictly usually ALL)
 * @RequirePermission(PermissionId.VIEW_HISTORY, PermissionId.VIEW_C_ROOM)
 * async complexAction() { ... }
 *
 * @param permissions - One or more permission IDs required to access the resource.
 */
export const RequirePermission = (...permissions: PermissionIdType[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
