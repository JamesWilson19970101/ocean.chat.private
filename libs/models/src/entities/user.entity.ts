import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/**
 * @enum {string}
 * @description Defines the possible online statuses for a user.
 */
export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

/**
 * @class User
 * Represents a user entity in the system.
 * This entity is used to store user-related information.
 * @extends Document
 */
@Schema({ timestamps: true })
export class User extends Document {
  /**
   * The name of the user. Users can customize the name.
   */
  @Prop({ type: String })
  name?: string;
  /**
   * The unique username of the user.
   */
  @Prop({ type: String, required: true, unique: true })
  username: string;

  /**
   * The type of user, e.g., 'user', 'bot', 'guest'.
   * @default 'user'
   */
  @Prop({ type: String, required: true, default: 'user' })
  type: string;

  /**
   * The active status of the user. A disabled user cannot log in.
   * @default true
   */
  @Prop({ type: Boolean, default: true })
  active: boolean;

  /**
   * The current online status of the user.
   * @default 'offline'
   */
  @Prop({ type: String, enum: UserStatus, default: UserStatus.OFFLINE })
  status: UserStatus;

  /**
   * The roles assigned to the user.
   * @default ['user']
   */
  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  /**
   * The email addresses associated with the user.
   * Each email object contains:
   * - address: The email address (must be unique).
   * - verified: A boolean indicating if the email has been verified.
   * The array allows for multiple email addresses per user.
   * The 'sparse' option allows multiple documents to have a null value for 'address'.
   */
  @Prop({
    type: [
      {
        address: { type: String, required: true, unique: true, sparse: true },
        verified: { type: Boolean, required: true, default: false },
        _id: false, // Do not create a separate _id for sub-documents in the array
      },
    ],
  })
  emails?: { address: string; verified: boolean }[];

  /**
   * An object containing the user's authentication credentials.<br />
   * <ul>
   *   <li><b>credentials.passwordHash:</b> - The hashed password of the user.</li>
   * </ul>
   */
  @Prop({
    type: {
      passwordHash: { type: String, required: true, select: false },
    },
    _id: false,
  })
  credentials: {
    passwordHash: string;
  };

  /**
   * The timestamp of the user's last login.
   */
  @Prop({ type: Date })
  lastLogin?: Date;
}

/**
 * @class UserIdentifier
 * @description A lean, identifiable representation of a user, used for message authors, mentions, etc.
 */
@Schema({ _id: false })
export class UserIdentifier {
  /** The unique ID of the user. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  _id: User | MongooseSchema.Types.ObjectId;

  /** The unique username of the user. */
  @Prop({ required: true })
  username: string;

  /** The display name of the user. */
  @Prop()
  name?: string;
}
export const UserIdentifierSchema =
  SchemaFactory.createForClass(UserIdentifier);

export const UserSchema = SchemaFactory.createForClass(User);
