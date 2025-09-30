import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Message,
  MessageSchema,
  Permission,
  PermissionSchema,
  Role,
  RoleSchema,
  Room,
  RoomSchema,
  Setting,
  SettingSchema,
  User,
  UserSchema,
} from './entities';
import { SettingsRepository, UserRepository } from './repositories';

const models = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
  { name: Setting.name, schema: SettingSchema },
  { name: Role.name, schema: RoleSchema },
  { name: Permission.name, schema: PermissionSchema },
  { name: Room.name, schema: RoomSchema },
  { name: Message.name, schema: MessageSchema },
]);

const repositories = [UserRepository, SettingsRepository];

@Module({
  providers: [...repositories],
  exports: [...repositories],
  imports: [models],
})
export class ModelsModule {}
