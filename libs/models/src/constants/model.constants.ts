/**
 * Enum identifying all available models in the system.
 * Used to selectively register schemas in microservices.
 */
export enum OceanModel {
  User = 'User',
  Setting = 'Setting',
  Role = 'Role',
  Permission = 'Permission',
  Room = 'Room',
  Message = 'Message',
  Group = 'Group',
  GroupMember = 'GroupMember',
}
