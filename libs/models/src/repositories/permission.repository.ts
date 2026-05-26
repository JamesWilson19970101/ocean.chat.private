import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Permission } from '../entities/permission.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class PermissionRepository extends BaseRepository<Permission> {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
  ) {
    super(permissionModel);
  }

  /**
   * Upserts a permission by its ID.
   * Useful for initializing or syncing default permissions from constants.
   */
  async upsert(
    permissionId: string,
    roles: string[],
    group?: string,
    section?: string,
  ): Promise<Permission> {
    return (await this.model
      .findOneAndUpdate(
        { _id: permissionId },
        { $set: { roles, group, section } },
        { upsert: true, new: true },
      )
      .lean()
      .exec()) as unknown as Permission;
  }

  /**
   * Adds a role to a permission if it doesn't already exist.
   */
  async addRole(permissionId: string, role: string): Promise<void> {
    await this.model
      .updateOne({ _id: permissionId }, { $addToSet: { roles: role } })
      .exec();
  }

  /**
   * Removes a role from a permission.
   */
  async removeRole(permissionId: string, role: string): Promise<void> {
    await this.model
      .updateOne({ _id: permissionId }, { $pull: { roles: role } })
      .exec();
  }

  /**
   * Finds all permissions that are granted to a specific role.
   */
  async findPermissionsByRole(role: string): Promise<Permission[]> {
    return await this.find({ roles: role });
  }

  /**
   * Finds the roles associated with a specific permission ID.
   */
  async findRolesById(permissionId: string): Promise<string[]> {
    const permission = (await this.model
      .findById(permissionId, { roles: 1, _id: 0 })
      .lean()
      .exec()) as unknown as Permission | null;

    return permission?.roles || [];
  }
}
