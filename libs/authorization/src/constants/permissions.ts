import { IPermissionDefinition } from '@ocean.chat/types';
/**
 * The list of all default permission definitions in the system.
 */
// TODO: Use permission of rocketchat as my base, change according to oceanchat needs
export const permissions: IPermissionDefinition[] = [
  // --- System Administration ---
  { _id: 'access-permissions', roles: ['admin'] },
  { _id: 'access-setting-permissions', roles: ['admin'] },
  { _id: 'assign-admin-role', roles: ['admin'] },
  { _id: 'assign-roles', roles: ['admin'] },
  { _id: 'view-logs', roles: ['admin'] },
  { _id: 'view-statistics', roles: ['admin'] },
  { _id: 'view-user-administration', roles: ['admin'] },
  { _id: 'manage-selected-settings', roles: ['admin'] },
  { _id: 'edit-privileged-setting', roles: ['admin'] },
  { _id: 'view-privileged-setting', roles: ['admin'] },
  { _id: 'run-migration', roles: ['admin'] },
  { _id: 'api-bypass-rate-limit', roles: ['admin', 'bot', 'app'] },

  // --- User Management ---
  { _id: 'create-user', roles: ['admin'] },
  { _id: 'delete-user', roles: ['admin'] },
  { _id: 'view-full-other-user-info', roles: ['admin'] },
  { _id: 'edit-other-user-info', roles: ['admin'] },
  { _id: 'edit-other-user-password', roles: ['admin'] },
  { _id: 'edit-other-user-avatar', roles: ['admin'] },
  { _id: 'create-personal-access-tokens', roles: ['admin', 'user'] },
  { _id: 'logout-other-user', roles: ['admin'] },

  // --- Room Creation ---
  { _id: 'create-c', roles: ['admin', 'user', 'bot', 'app'] }, // Create Public Channel
  { _id: 'create-p', roles: ['admin', 'user', 'bot', 'app'] }, // Create Private Group
  { _id: 'create-d', roles: ['admin', 'user', 'bot', 'app'] }, // Create Direct Message

  // --- Room Operations (Public) ---
  { _id: 'view-c-room', roles: ['admin', 'user', 'bot', 'app', 'anonymous'] },
  { _id: 'add-user-to-any-c-room', roles: ['admin'] },
  { _id: 'kick-user-from-any-c-room', roles: ['admin'] },
  { _id: 'delete-c', roles: ['admin', 'owner'] },

  // --- Room Operations (Private) ---
  { _id: 'view-p-room', roles: ['admin', 'user', 'anonymous', 'guest'] },
  { _id: 'add-user-to-any-p-room', roles: [] }, // No one by default
  { _id: 'kick-user-from-any-p-room', roles: [] }, // No one by default
  { _id: 'delete-p', roles: ['admin', 'owner'] },

  // --- Room Operations (General) ---
  { _id: 'view-d-room', roles: ['admin', 'user', 'bot', 'app', 'guest'] },
  { _id: 'view-joined-room', roles: ['guest', 'bot', 'app', 'anonymous'] },
  { _id: 'view-history', roles: ['admin', 'user', 'anonymous'] },
  { _id: 'add-user-to-joined-room', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'archive-room', roles: ['admin', 'owner'] },
  { _id: 'unarchive-room', roles: ['admin'] },
  { _id: 'edit-room', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'edit-room-avatar', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'leave-c', roles: ['admin', 'user', 'bot', 'anonymous', 'app'] },
  { _id: 'leave-p', roles: ['admin', 'user', 'bot', 'anonymous', 'app'] },
  { _id: 'preview-c-room', roles: ['admin', 'user', 'anonymous'] }, // Preview Public Channel

  // --- Member Management ---
  { _id: 'set-moderator', roles: ['admin', 'owner'] },
  { _id: 'set-owner', roles: ['admin', 'owner'] },
  { _id: 'set-leader', roles: ['admin', 'owner'] },
  { _id: 'remove-user', roles: ['admin', 'owner', 'moderator'] }, // Remove user from room
  { _id: 'ban-user', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'mute-user', roles: ['admin', 'owner', 'moderator'] },

  // --- Message Operations ---
  { _id: 'delete-message', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'delete-own-message', roles: ['admin', 'user'] },
  { _id: 'force-delete-message', roles: ['admin', 'owner'] },
  { _id: 'edit-message', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'pin-message', roles: ['owner', 'moderator', 'admin'] },
  { _id: 'post-readonly', roles: ['admin', 'owner', 'moderator'] }, // Post in read-only rooms
  { _id: 'set-readonly', roles: ['admin', 'owner'] },
  { _id: 'set-react-when-readonly', roles: ['admin', 'owner'] },
  { _id: 'mention-all', roles: ['admin', 'owner', 'moderator', 'user'] },
  { _id: 'mention-here', roles: ['admin', 'owner', 'moderator', 'user'] },
  { _id: 'bypass-time-limit-edit-and-delete', roles: ['bot', 'app'] }, // Bypass edit/delete time limit

  // --- Livechat (Example) ---
  {
    _id: 'view-l-room',
    roles: ['livechat-manager', 'livechat-monitor', 'livechat-agent', 'admin'],
  },
  {
    _id: 'view-livechat-manager',
    roles: ['livechat-manager', 'livechat-monitor', 'admin'],
  },
  {
    _id: 'manage-livechat-agents',
    roles: ['livechat-manager', 'livechat-monitor', 'admin'],
  },

  // --- Team (Example) ---
  { _id: 'create-team', roles: ['admin', 'user'] },
  { _id: 'delete-team', roles: ['admin', 'owner'] },
  { _id: 'edit-team', roles: ['admin', 'owner'] },
  { _id: 'add-team-member', roles: ['admin', 'owner', 'moderator'] },
  { _id: 'view-all-teams', roles: ['admin'] },
];
