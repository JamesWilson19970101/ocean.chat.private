import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Role } from '../entities/role.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class RoleRepository extends BaseRepository<Role> {
  constructor(@InjectModel(Role.name) private readonly roleModel: Model<Role>) {
    super(roleModel);
  }

  async upsert(
    name: string,
    description: string,
    scope: string,
  ): Promise<Role> {
    return (await this.model
      .findOneAndUpdate(
        { name },
        { $set: { description, scope } },
        { upsert: true, new: true },
      )
      .lean()
      .exec()) as unknown as Role;
  }
}
