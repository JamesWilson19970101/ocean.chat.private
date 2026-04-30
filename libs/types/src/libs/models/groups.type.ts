/**
 * @enum {string}
 * @description Defines the type of the group/room.
 * Maps to Rocket.Chat's 't' field.
 */
export enum GroupType {
  /** Public Channel: Searchable and joinable by anyone. */
  CHANNEL = 'c',
  /** Private Group: Invite only. */
  PRIVATE_GROUP = 'p',
  /** Direct Message: 1-on-1 communication. */
  DIRECT = 'd',
  /** Livechat: For customer support or broadcast scenarios(The administrator sends a message -> which is instantly distributed to 500 different Livechat rooms.). */
  LIVECHAT = 'l',
}
