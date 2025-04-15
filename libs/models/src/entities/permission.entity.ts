import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * @class Permission
 * Represents a permission entity in the system.
 * This entity is used to store permission information.
 * @extends Document
 */
@Schema()
export class Permission extends Document {
  /**
   * p stands for policy definition, g stands for role definition
   */
  @Prop({ type: String, required: true })
  conf: string;
}

export const UserSchema = SchemaFactory.createForClass(Permission);
