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
  Setting,
  SettingSchema,
  User,
  UserSchema,
} from '../entities';
import { SettingsRepository, UserRepository } from '../repositories';

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
};

/**
 * Mapping for Custom Repositories (Providers).
 * Some models might not have a custom repository yet (optional).
 */
export const REPOSITORY_MAP: Record<OceanModel, Type<any> | undefined> = {
  [OceanModel.User]: UserRepository,
  [OceanModel.Setting]: SettingsRepository,
  [OceanModel.Permission]: undefined,
  [OceanModel.Role]: undefined,
  [OceanModel.Message]: undefined,
  [OceanModel.Group]: undefined,
  [OceanModel.GroupMember]: undefined,
};
