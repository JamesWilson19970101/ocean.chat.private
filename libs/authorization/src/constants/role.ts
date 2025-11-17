import { IDefaultRole } from '@ocean.chat/types';
/**
 * @fileoverview
 * Default Role Definitions
 *
 * This defines the system's default roles, their scope, and description.
 * This is part of the "Single Source of Truth" (SSOT).
 *
 * @consumer apps/oceanchat-user (permission-seeder.service) - Used to write these
 * roles to the database on startup.
 */
// TODO: Use roles of rocketchat as my base, change according to oceanchat needs

/**
 * The list of all default role definitions in the system.
 */
export const defaultRoles: IDefaultRole[] = [
  // --- Global Roles (Scope: 'Users') ---
  { name: 'admin', scope: 'Users', description: 'Admin' },
  { name: 'user', scope: 'Users', description: 'User' },
  { name: 'bot', scope: 'Users', description: 'Bot' },
  { name: 'app', scope: 'Users', description: 'App' },
  { name: 'guest', scope: 'Users', description: 'Guest' },
  { name: 'anonymous', scope: 'Users', description: 'Anonymous' },

  // --- Scoped Roles (Scope: 'Subscriptions') ---
  // These roles are assigned to a user *within* a specific room.
  { name: 'owner', scope: 'Subscriptions', description: 'Owner' },
  { name: 'moderator', scope: 'Subscriptions', description: 'Moderator' },
  { name: 'leader', scope: 'Subscriptions', description: 'Leader' },

  // --- Livechat Roles (Example, Global) ---
  { name: 'livechat-agent', scope: 'Users', description: 'Livechat Agent' },
  { name: 'livechat-manager', scope: 'Users', description: 'Livechat Manager' },
  { name: 'livechat-monitor', scope: 'Users', description: 'Livechat Monitor' },
];
