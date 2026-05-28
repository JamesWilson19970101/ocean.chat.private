import { Type } from '@nestjs/common';
import { ModelDefinition } from '@nestjs/mongoose';

import { OceanModel } from '../constants/model.constants';
import {
  Group,
  GroupMember,
  GroupMemberSchema,
  GroupSchema,
  Message,
  MessageSchema,
  Permission,
  PermissionSchema,
  Role,
  RoleSchema,
  Sequence,
  SequenceSchema,
  Setting,
  SettingSchema,
  Team,
  TeamMember,
  TeamMemberSchema,
  TeamSchema,
  User,
  UserSchema,
} from '../entities';
import {
  GroupMemberRepository,
  GroupRepository,
  MessageRepository,
  PermissionRepository,
  RoleRepository,
  SequenceRepository,
  SettingsRepository,
  UserRepository,
} from '../repositories';

/**
 * Mapping for Mongoose Schema Definitions.
 */
export const MODEL_DEFINITIONS: Record<OceanModel, ModelDefinition> = {
  [OceanModel.User]: { name: User.name, schema: UserSchema },
  [OceanModel.Setting]: { name: Setting.name, schema: SettingSchema },
  [OceanModel.Role]: { name: Role.name, schema: RoleSchema },
  [OceanModel.Permission]: { name: Permission.name, schema: PermissionSchema },
  [OceanModel.Message]: { name: Message.name, schema: MessageSchema },
  [OceanModel.Group]: { name: Group.name, schema: GroupSchema },
  [OceanModel.GroupMember]: {
    name: GroupMember.name,
    schema: GroupMemberSchema,
  },
  [OceanModel.Team]: { name: Team.name, schema: TeamSchema },
  [OceanModel.TeamMember]: {
    name: TeamMember.name,
    schema: TeamMemberSchema,
  },
  [OceanModel.Sequence]: { name: Sequence.name, schema: SequenceSchema },
};

/**
 * Mapping for Custom Repositories (Providers).
 * Some models might not have a custom repository yet (optional).
 */
export const REPOSITORY_MAP: Record<OceanModel, Type<any> | undefined> = {
  [OceanModel.User]: UserRepository,
  [OceanModel.Setting]: SettingsRepository,
  [OceanModel.Permission]: PermissionRepository,
  [OceanModel.Role]: RoleRepository,
  [OceanModel.Message]: MessageRepository,
  [OceanModel.Group]: GroupRepository,
  [OceanModel.GroupMember]: GroupMemberRepository,
  [OceanModel.Sequence]: SequenceRepository,
  [OceanModel.Team]: undefined,
  [OceanModel.TeamMember]: undefined,
};
