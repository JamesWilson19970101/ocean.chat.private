import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * @class User
 * Represents a user entity in the system.
 * This entity is used to store user-related information.
 * @extends Document
 */
@Schema()
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

  @Prop({
    type: [
      {
        address: { type: String, required: true, unique: true, sparse: true },
        verified: { type: Boolean, required: true, default: false },
        _id: false, // Do not create a separate _id for sub-documents in the array
      },
    ],
    default: [], // Default to an empty array
  })
  emails: {
    address: string;
    verified: boolean;
  }[];

  /**
   * An object containing the user's authentication credentials.<br />
   * <ul>
   *   <li><b>credentials.passwordHash:</b> - The hashed password of the user.</li>
   * </ul>
   */
  @Prop({
    type: {
      passwordHash: { type: String, required: true },
    },
    _id: false,
  })
  credentials: {
    passwordHash: string;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
