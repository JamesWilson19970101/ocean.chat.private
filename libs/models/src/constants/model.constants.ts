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
  //   GroupMember = 'GroupMember', // Add GroupMember as we discussed previously
}
