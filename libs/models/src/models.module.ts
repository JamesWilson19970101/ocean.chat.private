import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

const models = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
]);

const repositories = [UserRepository];

@Module({
  providers: [...repositories],
  exports: [models, ...repositories],
  imports: [models],
})
export class ModelsModule {}
