/**
 * @fileoverview
 * Constants for NestJS Metadata Keys.
 *
 * These keys are used by Decorators (to set metadata) and Guards (to read metadata).
 * Keeping them in a separate file prevents circular dependencies and magic strings.
 */

export const PERMISSIONS_METADATA_KEY = 'ocean_chat:permissions';
export const ROLES_METADATA_KEY = 'ocean_chat:roles';
