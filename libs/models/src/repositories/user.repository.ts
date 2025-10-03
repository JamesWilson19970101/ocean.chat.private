import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseRepository } from '../base.repository';
import { AuthProvider, User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {
    super(userModel);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.model.findOne({ email }).exec();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.model.findOne({ username }).exec();
  }

  async findOneByUsernameAndProvider(
    username: string,
    provider: AuthProvider,
  ): Promise<{ [key: string]: any; passwordHash: string } | null> {
    const user = await this.model
      .findOne({
        username,
        'providers.provider': provider,
      })
      .select('+providers.passwordHash') // We need to explicitly include passwordHash since it's excluded by default
      .lean() // Use lean() to get a plain JavaScript object
      .exec();

    if (!user) return null;

    const localProvider = user.providers.find((p) => p.provider === provider);
    if (!localProvider?.passwordHash) return null;

    return { ...user, passwordHash: localProvider.passwordHash };
  }
}
