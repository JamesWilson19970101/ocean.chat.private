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
   * The email address of the user. The sparse option creates an index when emails exist. The unique option creates an index regardless of whether the corresponding filed exists.
   */
  @Prop({ type: String, unique: true, sparse: true })
  email?: string;
  /**
   * The unique username of the user.
   */
  @Prop({ type: String, required: true, unique: true })
  username: string;
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
    select: false,
    _id: false,
  })
  credentials: {
    passwordHash: string;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
