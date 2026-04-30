import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * @enum {string}
 * @description Defines the scope of a role.
 * - `Users`: Global role, assigned directly to a user document.
 * - `Subscriptions`: Room-specific role, assigned to a user within a specific room (e.g., a moderator in one channel).
 */
export enum RoleScope {
  USERS = 'Users',
  SUBSCRIPTIONS = 'Subscriptions',
}

/**
 * @class Role
 * @description Represents a user role in the system, which is a collection of permissions.
 * @extends Document
 */
@Schema({ timestamps: true })
export class Role extends Document {
  /**
   * The unique name of the role, used as the identifier.
   * This corresponds to the values in the User.roles array.
   * @example 'admin', 'moderator', 'user'
   */
  @Prop({ type: String, required: true, unique: true })
  name: string;

  /**
   * A human-readable description of the role for display in admin panels.
   */
  @Prop({ type: String, required: true })
  description: string;

  /**
   * The scope of the role. 'Users' for global roles, 'Subscriptions' for room-specific roles.
   * @default RoleScope.USERS
   */
  @Prop({ type: String, enum: RoleScope, default: RoleScope.USERS })
  scope: RoleScope;

  /**
   * If true, this is a system-level role that cannot be deleted.
   * @default false
   */
  @Prop({ type: Boolean, default: false })
  protected: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
