import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

import { Room } from './room.entity';
import { UserIdentifier, UserIdentifierSchema } from './user.entity';

/**
 * @enum {string}
 * @description Defines the type of the message, used to distinguish normal messages from various system events.
 * - `uj`: User Joined
 * - `ul`: User Left
 * - `ru`: User Removed from room
 * - `au`: User Added to room
 * - `command`: A slash command
 * - `system`: A generic system message
 * - `e2e`: End-to-end encrypted message
 * - `otr`: Off-the-Record message
 * - `otr-ack`: Off-the-Record acknowledgment
 * - `livechat-started`: A new livechat session has started
 * - `livechat-close`: A livechat session has been closed
 * - `livechat_video_call`: A livechat video call event
 * - `livechat_webrtc_video_call`: A livechat WebRTC video call event
 * - `livechat_navigation_history`: Livechat navigation history event
 */
export enum MessageType {
  USER_JOINED = 'uj',
  USER_LEFT = 'ul',
  USER_REMOVED = 'ru',
  USER_ADDED = 'au',
  COMMAND = 'command',
  SYSTEM = 'system',
  E2E = 'e2e',
  // OTR = 'otr', // TODO： implement OTR
  // OTR_ACK = 'otr-ack',
  LIVECHAT_STARTED = 'livechat-started',
  LIVECHAT_CLOSED = 'livechat-close',
  LIVECHAT_VIDEO_CALL = 'livechat_video_call',
  LIVECHAT_WEBRTC_VIDEO_CALL = 'livechat_webrtc_video_call',
  LIVECHAT_NAVIGATION_HISTORY = 'livechat_navigation_history',
}

/**
 * @class Reaction
 * @description Represents an emoji reaction to a message.
 */
@Schema({ _id: false })
export class Reaction {
  /** The emoji character. */
  @Prop({ required: true })
  emoji: string;

  /** A list of usernames who added this reaction. */
  @Prop({ type: [String], required: true })
  usernames: string[];
}
export const ReactionSchema = SchemaFactory.createForClass(Reaction);

/**
 * @class Attachment
 * @description Represents a file, image, or other media attached to a message.
 * This is a basic structure that can be extended.
 */
@Schema({ _id: false, timestamps: true })
export class Attachment {
  /** The title of the attachment. */
  @Prop()
  title?: string;

  /** A description of the attachment. */
  @Prop()
  description?: string;

  /** A URL for the attachment's title. */
  @Prop()
  title_link?: string;

  /** The URL of the image to display. */
  @Prop()
  image_url?: string;
}
export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

/**
 * @class Message
 * @description Represents a message entity in a room.
 * @extends Document
 */
@Schema({ timestamps: true })
export class Message extends Document {
  /** The ID of the room where the message was sent. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  })
  rid: Room | MongooseSchema.Types.ObjectId;

  /** The actual message content. */
  @Prop({ required: true })
  msg: string;

  /** The user who sent the message. */
  @Prop({ type: UserIdentifierSchema, required: true })
  u: UserIdentifier;

  /** The type of the message (e.g., system message, command). */
  @Prop({ type: String, enum: MessageType })
  t?: MessageType;

  /** A list of users mentioned in the message. */
  @Prop({ type: [UserIdentifierSchema] })
  mentions?: UserIdentifier[];

  /** A list of attachments, such as files or images. */
  @Prop({ type: [AttachmentSchema] })
  attachments?: Attachment[];

  /** A map of reactions to the message. */
  @Prop(raw({}))
  reactions?: Record<string, Reaction>;

  /** The timestamp when the message was last edited. */
  @Prop()
  editedAt?: Date;

  /** The user who last edited the message. */
  @Prop({ type: UserIdentifierSchema })
  editedBy?: UserIdentifier;

  /** For threads: the ID of the main message this message is a reply to. */
  @Prop({ index: true })
  tmid?: string;

  /** For threads: the count of replies. Only for the main message. */
  @Prop()
  tcount?: number;

  /** For threads: the timestamp of the last reply. Only for the main message. */
  @Prop()
  tlm?: Date;

  /** Parsed URLs from the message content. */
  @Prop({ type: [raw({})] })
  urls?: Record<string, any>[];

  /** End-to-end encryption status. */
  @Prop({ type: String, enum: ['pending', 'done'] })
  e2e?: 'pending' | 'done';

  /** Whether the message is unread. */
  @Prop()
  unread?: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
