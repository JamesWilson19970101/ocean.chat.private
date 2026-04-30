import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GroupType } from '@ocean.chat/types';
import { Document, Schema as MongooseSchema } from 'mongoose';

import { UserIdentifier, UserIdentifierSchema } from './user.entity';

/**
 * @class GroupMessageSnapshot
 * @description A denormalized snapshot of the last message in the group.
 * Stores the last message content directly on the Group document to avoid
 * joining the Messages collection when rendering the chat list.
 * Heavily improves performance for the "Recent Chats" list.
 */
@Schema({ _id: false })
export class GroupMessageSnapshot {
  /** The ID of the message. */
  @Prop({ type: String })
  _id: string;

  /** The text content of the message. */
  @Prop({ type: String })
  msg: string;

  /** The sender of the message (snapshot). */
  @Prop({ type: UserIdentifierSchema })
  u: UserIdentifier;

  /** The timestamp when the message was sent. */
  @Prop({ type: Date })
  ts: Date;
}
const GroupMessageSnapshotSchema =
  SchemaFactory.createForClass(GroupMessageSnapshot);

/**
 * @class Group
 * @description Represents the 'groups' collection in the database (equivalent to room) </br>
 * It act as the container of messages. </br>
 * Note: User Relationships (membership, unread counts) are NOT store here,
 * but in 'group_members'.
 */
@Schema({ timestamps: true })
export class Group extends Document {
  /**
   * The type of group
   * Determines permission logic (e.g., channels are public, DMs are restricted).
   */
  @Prop({ type: String, enum: GroupType, required: true })
  type: GroupType;

  /**
   * The display name or handle of the group.
   * Used for searching or display.
   * Note: Uniqueness is NOT enforced. It is perfectly valid for multiple public channels
   * to share the same name (e.g. multiple 'General' channels).
   * Uniqueness is only enforced on the _id.
   */
  @Prop({ type: String, index: true })
  name?: string;

  /**
   * Snapshot of the creator/owner.
   * Rocket.Chat field: `u`
   */
  @Prop({ type: UserIdentifierSchema, required: true })
  u: UserIdentifier;

  /**
   * Total message count.
   * Useful for statistics and generating incremental message IDs if needed.
   */
  @Prop({ type: Number, default: 0 })
  msgs: number;

  /**
   * Total member count (Denormalized).
   * While this can be counted from 'group_members', storing it here allows
   * for O(1) read performance when displaying member counts in lists.
   */
  @Prop({ type: Number, default: 0 })
  membersCount: number;

  /**
   * Last Active Timestamp (Last Modified/Message).
   * **Critical**: Updated on every new message.
   * Used for sorting the conversation list (most recent on top).
   */
  @Prop({ type: Date, index: -1 })
  lastActiveAt?: Date;

  /**
   * Snapshot of the last message.
   * Used for displaying the preview in the conversation list.
   */
  @Prop({ type: GroupMessageSnapshotSchema })
  lastMessage?: GroupMessageSnapshot;

  /**
   * Group Announcement.
   * Pinned text for rules or important info.
   */
  @Prop({ type: String })
  announcement?: string;

  /**
   * Group Topic/Description.
   */
  @Prop({ type: String })
  topic?: string;

  /**
   * Read-Only mode.
   * If true, only users with specific permissions (e.g., owner, moderator) can post.
   */
  @Prop({ type: Boolean, default: false })
  readOnly: boolean;

  /**
   * Archived status.
   * Soft-delete state. Archived groups are read-only and hidden from default lists.
   */
  @Prop({ type: Boolean, default: false })
  archived: boolean;

  /**
   * Default group.
   * If true, new users are automatically added to this group upon registration.
   */
  @Prop({ type: Boolean, default: false })
  default: boolean;

  /**
   * Avatar ETag (Hash).
   * Used for client-side caching of group avatars.
   */
  @Prop({ type: String })
  avatarETag?: string;

  /**
   * Custom Fields.
   * For business extensibility (e.g., CRM IDs, external links).
   */
  @Prop({ type: MongooseSchema.Types.Mixed })
  customFields?: Record<string, any>;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// Compound Indexes for optimization
// 1. Find public channels by name: { name: 1, type: 1 }
GroupSchema.index({ name: 1, type: 1 });
