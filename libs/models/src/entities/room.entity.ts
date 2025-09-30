import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

import { Message, MessageSchema } from './message.entity';
import { User, UserIdentifier, UserIdentifierSchema } from './user.entity';

/**
 * @enum {string}
 * @description Defines the type of the room.
 * - `c`: Public Channel
 * - `p`: Private Group
 * - `d`: Direct Message
 * - `l`: Livechat
 */
export enum RoomType {
  PUBLIC_CHANNEL = 'c',
  PRIVATE_GROUP = 'p',
  DIRECT_MESSAGE = 'd',
  LIVECHAT = 'l',
}

/**
 * @enum {string}
 * @description Defines the status of a Livechat room.
 */
export enum LivechatRoomStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  QUEUED = 'queued',
  ON_HOLD = 'on-hold',
}

/**
 * @class Room
 * @description Represents a chat room, which can be a channel, group, or direct message.
 * @extends Document
 */
@Schema({ timestamps: true })
export class Room extends Document {
  /** The type of the room. */
  @Prop({ type: String, enum: RoomType, required: true })
  t: RoomType;

  /** The display name of the room. Optional for direct messages. */
  @Prop()
  name?: string;

  /** The user-friendly, formatted name of the room. */
  @Prop()
  fname?: string;

  /** The user who created the room. */
  @Prop({ type: UserIdentifierSchema, required: true })
  u: UserIdentifier;

  /** An array of user IDs belonging to the room. Crucial for direct messages. */
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User' })
  uids?: (User | MongooseSchema.Types.ObjectId)[];

  /** An array of usernames belonging to the room. */
  @Prop({ type: [String] })
  usernames?: string[];

  /** The total number of messages in the room. */
  @Prop({ default: 0 })
  msgs: number;

  /** The total number of users in the room. */
  @Prop({ default: 0 })
  usersCount: number;

  /** The last message sent in the room. Denormalized for performance. */
  @Prop({ type: MessageSchema })
  lastMessage?: Message;

  /** The timestamp of the last message. Used for sorting. */
  @Prop({ type: Date, index: true })
  lm?: Date;

  /** Indicates if the room is read-only. */
  @Prop({ default: false })
  ro: boolean;

  /** Indicates if the room is a broadcast room. */
  @Prop({ default: false })
  broadcast: boolean;

  /** Indicates if this is a default room for new users. */
  @Prop({ default: false })
  default: boolean;

  /** Indicates if the room is archived. */
  @Prop({ default: false })
  archived: boolean;

  /** Indicates if the room is end-to-end encrypted. */
  @Prop({ default: false })
  encrypted: boolean;

  /** The topic of the room. */
  @Prop()
  topic?: string;

  /** The description of the room. */
  @Prop()
  description?: string;

  /** A list of user IDs who have muted this room. */
  @Prop({ type: [String] })
  muted?: string[];

  // --- Livechat specific fields ---

  /** Visitor information for Livechat rooms. */
  @Prop({ type: Object })
  v?: {
    _id: string;
    token: string;
    username?: string;
    status?: 'online' | 'offline';
  };

  /** The department ID for Livechat routing. */
  @Prop()
  departmentId?: string;

  /** The agent currently serving the Livechat. */
  @Prop({ type: UserIdentifierSchema })
  servedBy?: UserIdentifier;

  /** The status of the Livechat room. */
  @Prop({ type: String, enum: LivechatRoomStatus })
  status?: LivechatRoomStatus;

  /** The timestamp when the Livechat room was closed. */
  @Prop()
  closedAt?: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Add indexes for common query patterns
RoomSchema.index(
  { t: 1, name: 1 },
  { unique: true, partialFilterExpression: { t: { $in: ['c', 'p'] } } },
);
RoomSchema.index({ 'uids.0': 1 }); // Index for direct message lookups
RoomSchema.index({ lm: -1 }); // Index for sorting by last message time
