import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {
  @Prop({ type: String })
  name?: string;

  @Prop({ type: String, unique: true, sparse: true })
  email?: string;

  @Prop({ type: String, required: true, unique: true })
  username: string;

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
