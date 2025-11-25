import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GroupType } from '@ocean.chat/types';
import { Document, Schema as MongooseSchema } from 'mongoose';

import { UserIdentifier, UserIdentifierSchema } from './user.entity';

/**
 * @class GroupMember
 * @description Represents the relationship between a User and a Group.
 * This is a Pivot Table/Entity that stores user-specific settings for a group.
 */
@Schema({ timestamps: true })
export class GroupMember extends Document {
  /**
   * The Group ID.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  })
  groupId: string;

  /**
   * The User snapshot.
   * Stores minimal user info to avoid joining the Users collection.
   */
  @Prop({ type: UserIdentifierSchema, required: true })
  user: UserIdentifier;

  /**
   * Group Type snapshot.
   * Stored here to filter subscriptions by type (e.g., "Show me all my DMs") without joining Groups.
   */
  @Prop({ type: String, enum: GroupType, required: true })
  type: GroupType;

  /**
   * Personalized Group Name.
   * Allows the user to rename the group just for themselves.
   *
   * Private chat (Direct): GroupMember.name is different (it stores the other person's name).
   * Group chat (Channel/Group): GroupMember.name is the same as Group.name (it's a redundant snapshot).
   */
  @Prop({ type: String, required: true })
  name: string;

  /**
   * Open status.
   * Whether the conversation is open in the user's sidebar.
   * true (default): The group or private chat will appear in the user's left-hand list.
   * false: The user clicked the "Hide" or "Close Chat" button. This does not exit the group; it simply removes it temporarily from the list to keep the interface clean.
   */
  @Prop({ type: Boolean, default: true })
  open: boolean;

  /**
   * Alert status.
   * True if the user has a visual alert (e.g., a mention) in this group.
   * `unread > 0` and `alert: false`: There are new messages in the group, but no one has contacted you. The UI will typically display a gray number or only the group name in bold.
   * `unread > 0` and `alert: true`: There are new messages in the group, and someone has @mentioned you (@user), or someone has sent an all-user notification (@all). The UI will typically display a prominent red/orange logo, or an "@" icon.
   */
  @Prop({ type: Boolean, default: false })
  alert: boolean;

  /**
   * Unread message count.
   * The number of messages sent since the user's `lastSeenAt`.
   */
  @Prop({ type: Number, default: 0 })
  unread: number;

  /**
   * User-specific roles in this group.
   * e.g., ['owner', 'moderator'].
   */
  @Prop({ type: [String], default: [] })
  roles: string[];

  /**
   * Last Seen Timestamp.
   * The time when the user last read messages in this group.
   * Used to calculate the 'unread' count and the 'New Messages' separator.
   */
  @Prop({ type: Date })
  lastSeenAt?: Date;

  /**
   * Hide Mention Status.
   * If true, mentions won't trigger a badge count (Mute Mentions).
   */
  @Prop({ type: Boolean, default: false })
  hideMentionStatus: boolean;

  /**
   * Disable Notifications.
   * If true, push notifications are disabled for this group.
   * Rocket.Chat field: `disableNotifications`
   */
  @Prop({ type: Boolean, default: false })
  disableNotifications: boolean;
}

export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);
// Compound Indexes for frequent access patterns:
// 1. "Get my group list": Find by user, sort by update time.
GroupMemberSchema.index({ 'user._id': 1, updatedAt: -1 });

// 2. "Is user in this group?": Find by user and group.
GroupMemberSchema.index({ 'user._id': 1, groupId: 1 }, { unique: true });

// 3. "Get all members of a group": Used for broadcasting messages.
GroupMemberSchema.index({ groupId: 1 });

// 4. "Find open DMs for user": Used for sidebar rendering.
GroupMemberSchema.index({ 'user._id': 1, open: 1, type: 1 });
