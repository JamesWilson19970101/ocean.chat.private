import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Setting, SettingSchema, User, UserSchema } from './entities';
import { SettingsRepository, UserRepository } from './repositories';

const models = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
  { name: Setting.name, schema: SettingSchema },
]);

const repositories = [UserRepository, SettingsRepository];

@Module({
  providers: [...repositories],
  exports: [...repositories],
  imports: [models],
})
export class ModelsModule {}
