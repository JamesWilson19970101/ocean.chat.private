import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

import { UserIdentifier, UserIdentifierSchema } from './user.entity';

/**
 * @class TeamMember
 * @description Represents the 'team_members' collection in the database.
 * A Pivot Table that defines the Many-to-Many relationship between Users and Teams.
 *
 * Design Intent: Decoupling team membership from group membership allows for hierarchical role
 * propagation. For example, a user with the 'owner' role in the TeamMember collection will
 * automatically inherit admin privileges across all child Groups associated with this team.
 */
@Schema({ timestamps: true })
export class TeamMember extends Document {
  /**
   * The Team ID.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true,
  })
  teamId: string;

  /**
   * The User snapshot.
   * Stores minimal user info to avoid joining the Users collection during team directory rendering.
   */
  @Prop({ type: UserIdentifierSchema, required: true })
  user: UserIdentifier;

  /**
   * User-specific roles scoped exclusively to this team.
   * e.g., `['owner']`, `['moderator']`, or `['member']`.
   *
   * Design Intent: Roles defined here override or enhance standard group roles.
   * A 'moderator' of a team can moderate *any* group under this team without needing
   * to be explicitly added as a moderator in each `group_members` document.
   */
  @Prop({ type: [String], default: ['member'] })
  roles: string[];

  /**
   * Snapshot of the user who invited or added this member.
   * Important for audit logs, invitations tracking, and administrative reference.
   */
  @Prop({ type: UserIdentifierSchema })
  addedBy?: UserIdentifier;

  /**
   * Disable Notifications for the entire Team.
   * If true, acts as a master switch to mute push notifications for ALL groups belonging to this team.
   */
  @Prop({ type: Boolean, default: false })
  disableNotifications: boolean;
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

// Compound Indexes for frequent access patterns:

// 1. "Get all teams the user joined": Find by user, useful for rendering the leftmost workspace sidebar.
TeamMemberSchema.index({ 'user._id': 1 });

// 2. "Is user in this team?" & "Prevent duplicate joins": Unique constraint for a user within a team.
TeamMemberSchema.index({ teamId: 1, 'user._id': 1 }, { unique: true });

// 3. "Get all owners/admins of a team": Useful for sending administrative alerts or evaluating permissions.
TeamMemberSchema.index({ teamId: 1, roles: 1 });
