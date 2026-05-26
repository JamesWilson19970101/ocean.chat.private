import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * @class Permission
 * Represents a permission entity in the system.
 * This entity is used to store permission information.
 * @extends Document
 */
@Schema({ timestamps: true })
export class Permission extends Document<string> {
  /**
   * The unique string identifier for the permission.
   */
  @Prop({ type: String })
  declare _id: string;

  /**
   * An array of role names that are granted this permission.
   * @example ['admin', 'owner']
   */
  @Prop({ type: [String], required: true })
  roles: string[];

  /**
   * The group this permission belongs to, for UI organization.
   */
  @Prop()
  group?: string;

  /**
   * The section within a group, for further UI organization.
   */
  @Prop()
  section?: string;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
