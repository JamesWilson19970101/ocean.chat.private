import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

import { UserIdentifier, UserIdentifierSchema } from './user.entity';

export enum TeamVisibility {
  PUBLIC = 0,
  PRIVATE = 1,
}

/**
 * @class Team
 * @description Represents the 'teams' collection in the database.
 * A Team acts as an umbrella structure (Workspace/Guild) that groups multiple Groups/Channels together.
 *
 * Design Intent: In large organizations or communities, assigning users to dozens of channels individually
 * introduces heavy O(N) database operations and consistency risks. By utilizing a 'Team', a user can be
 * added to a Team just once, automatically granting them access to all public child groups under this umbrella.
 */
@Schema({ timestamps: true })
export class Team extends Document {
  /**
   * The display name of the team.
   * Note: Typically enforced to be unique across the entire platform or workspace.
   */
  @Prop({ type: String, required: true, unique: true, index: true })
  name: string;

  /**
   * The visibility type of the team.
   * - 0 (PUBLIC): Anyone in the workspace can search and join freely.
   * - 1 (PRIVATE): Only invited users can join or see this team.
   */
  @Prop({ type: Number, enum: TeamVisibility, default: TeamVisibility.PUBLIC })
  type: TeamVisibility;

  /**
   * The Main Group ID (Room ID).
   *
   * Design Intent: When a Team is created, the system typically provisions a default
   * "General" or "Announcements" group exclusively for this team. This field binds the team
   * to its primary channel.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Group' })
  mainGroupId?: string;

  /**
   * Snapshot of the creator/owner.
   * Storing this denormalized payload prevents JOINs when rendering the Team directory.
   */
  @Prop({ type: UserIdentifierSchema, required: true })
  u: UserIdentifier;

  /**
   * A brief description or topic for the team.
   */
  @Prop({ type: String })
  description?: string;

  /**
   * Custom Fields.
   * For business extensibility (e.g., tying a Team to an external SaaS organization ID).
   */
  @Prop({ type: MongooseSchema.Types.Mixed })
  customFields?: Record<string, any>;

  /**
   * Active status.
   * Soft-delete state. If false, the team and all its child groups might be considered archived/suspended.
   */
  @Prop({ type: Boolean, default: true })
  active: boolean;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

// Optimization: fast lookup for active public teams
TeamSchema.index({ type: 1, active: 1 });
