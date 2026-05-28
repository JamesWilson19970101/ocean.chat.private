import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { GroupMember } from '../entities';
import { BaseRepository } from './base.repository';

@Injectable()
export class GroupMemberRepository extends BaseRepository<GroupMember> {
  constructor(
    @InjectModel(GroupMember.name) private groupMemberModel: Model<GroupMember>,
  ) {
    super(groupMemberModel);
  }

  /**
   * Finds all groups a user belongs to.
   * Leverages the {'user._id': 1, updatedAt: -1} compound index.
   * @param userId The user ID
   * @returns Array of group members
   */
  async findGroupsByUserId(userId: string): Promise<GroupMember[]> {
    return this.find(
      { 'user._id': userId },
      { groupId: 1, type: 1, name: 1, _id: 0 },
      {
        sort: { updatedAt: -1 },
      },
    );
  }
}
