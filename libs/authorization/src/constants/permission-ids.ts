/**
 * @fileoverview
 * Type-safe Permission ID Constants.
 *
 * This provides a const object (e.g., PermissionId.ASSIGN_ROLES)
 * to be used in decorators like `@Permissions(PermissionId.ASSIGN_ROLES)`.
 * It prevents the use of "magic strings" (hardcoded strings) in the codebase.
 *
 * @consumer All microservices (api-gateway, message, group, etc.)
 */
// This object maps the plain string IDs from 'permissions.ts' to
// type-safe, auto-completable constants.
export const PermissionId = {
  // --- System Administration ---
  ACCESS_PERMISSIONS: 'access-permissions',
  ACCESS_SETTING_PERMISSIONS: 'access-setting-permissions',
  ASSIGN_ADMIN_ROLE: 'assign-admin-role',
  ASSIGN_ROLES: 'assign-roles',
  VIEW_LOGS: 'view-logs',
  VIEW_STATISTICS: 'view-statistics',
  VIEW_USER_ADMINISTRATION: 'view-user-administration',
  MANAGE_SELECTED_SETTINGS: 'manage-selected-settings',
  EDIT_PRIVILEGED_SETTING: 'edit-privileged-setting',
  VIEW_PRIVILEGED_SETTING: 'view-privileged-setting',
  RUN_MIGRATION: 'run-migration',
  API_BYPASS_RATE_LIMIT: 'api-bypass-rate-limit',

  // --- User Management ---
  CREATE_USER: 'create-user',
  DELETE_USER: 'delete-user',
  VIEW_FULL_OTHER_USER_INFO: 'view-full-other-user-info',
  EDIT_OTHER_USER_INFO: 'edit-other-user-info',
  EDIT_OTHER_USER_PASSWORD: 'edit-other-user-password',
  EDIT_OTHER_USER_AVATAR: 'edit-other-user-avatar',
  CREATE_PERSONAL_ACCESS_TOKENS: 'create-personal-access-tokens',
  LOGOUT_OTHER_USER: 'logout-other-user',

  // --- Room Creation ---
  CREATE_C: 'create-c', // Create Public Channel
  CREATE_P: 'create-p', // Create Private Group
  CREATE_D: 'create-d', // Create Direct Message

  // --- Room Operations (Public) ---
  VIEW_C_ROOM: 'view-c-room',
  ADD_USER_TO_ANY_C_ROOM: 'add-user-to-any-c-room',
  KICK_USER_FROM_ANY_C_ROOM: 'kick-user-from-any-c-room',
  DELETE_C: 'delete-c',

  // --- Room Operations (Private) ---
  VIEW_P_ROOM: 'view-p-room',
  ADD_USER_TO_ANY_P_ROOM: 'add-user-to-any-p-room',
  KICK_USER_FROM_ANY_P_ROOM: 'kick-user-from-any-p-room',
  DELETE_P: 'delete-p',

  // --- Room Operations (General) ---
  VIEW_D_ROOM: 'view-d-room',
  VIEW_JOINED_ROOM: 'view-joined-room',
  VIEW_HISTORY: 'view-history',
  ADD_USER_TO_JOINED_ROOM: 'add-user-to-joined-room',
  ARCHIVE_ROOM: 'archive-room',
  UNARCHIVE_ROOM: 'unarchive-room',
  EDIT_ROOM: 'edit-room',
  EDIT_ROOM_AVATAR: 'edit-room-avatar',
  LEAVE_C: 'leave-c',
  LEAVE_P: 'leave-p',
  PREVIEW_C_ROOM: 'preview-c-room',

  // --- Member Management ---
  SET_MODERATOR: 'set-moderator',
  SET_OWNER: 'set-owner',
  SET_LEADER: 'set-leader',
  REMOVE_USER: 'remove-user',
  BAN_USER: 'ban-user',
  MUTE_USER: 'mute-user',

  // --- Message Operations ---
  DELETE_MESSAGE: 'delete-message',
  DELETE_OWN_MESSAGE: 'delete-own-message',
  FORCE_DELETE_MESSAGE: 'force-delete-message',
  EDIT_MESSAGE: 'edit-message',
  PIN_MESSAGE: 'pin-message',
  POST_READONLY: 'post-readonly',
  SET_READONLY: 'set-readonly',
  SET_REACT_WHEN_READONLY: 'set-react-when-readonly',
  MENTION_ALL: 'mention-all',
  MENTION_HERE: 'mention-here',
  BYPASS_TIME_LIMIT_EDIT_AND_DELETE: 'bypass-time-limit-edit-and-delete',

  // --- Livechat (Example) ---
  VIEW_L_ROOM: 'view-l-room',
  VIEW_LIVECHAT_MANAGER: 'view-livechat-manager',
  MANAGE_LIVECHAT_AGENTS: 'manage-livechat-agents',

  // --- Team (Example) ---
  CREATE_TEAM: 'create-team',
  DELETE_TEAM: 'delete-team',
  EDIT_TEAM: 'edit-team',
  ADD_TEAM_MEMBER: 'add-team-member',
  VIEW_ALL_TEAMS: 'view-all-teams',
} as const;

// Create a TypeScript type from the const object's values
// This allows me to type function parameters: myFunc(permission: PermissionIdType)
export type PermissionIdType = (typeof PermissionId)[keyof typeof PermissionId];
