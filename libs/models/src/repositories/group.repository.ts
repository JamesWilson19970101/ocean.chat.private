import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InsertManyOptions, Model } from 'mongoose';

import { Group, GroupMember, GroupMessageSnapshot } from '../entities';
import { BaseRepository } from './base.repository';

@Injectable()
export class GroupRepository extends BaseRepository<Group> {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(GroupMember.name) private groupMemberModel: Model<GroupMember>,
  ) {
    super(groupModel);
  }

  /**
   * Updates the 'lastMessage' snapshot and increments the message count.
   * This is a critical "denormalization" operation called every time a message is sent.
   * It ensures the conversation list can be rendered without joining the Messages collection.
   * @param groupId The group ID
   * @param message The message snapshot to store
   */
  async updateLastMessageAndIncrementCount(
    groupId: string,
    message: GroupMessageSnapshot,
  ): Promise<void> {
    await this.model
      .updateOne(
        { _id: groupId },
        {
          $set: {
            lastMessage: message,
            lastActiveAt: message.ts,
          },
          $inc: { msgs: 1 },
        },
      )
      .exec();
  }

  /**
   * Increments the member count of a group.
   * Used when users join or leave.
   * @param groupId The group ID
   * @param count +1 or -1
   */
  async incMemberCount(groupId: string, count: number): Promise<void> {
    await this.model
      .updateOne({ _id: groupId }, { $inc: { membersCount: count } })
      .exec();
  }

  /**
   * Inserts multiple group members efficiently.
   * @param members Array of group members to insert
   */
  async insertManyMembers(
    members: Partial<GroupMember>[],
    options?: InsertManyOptions,
  ): Promise<GroupMember[]> {
    return (await this.groupMemberModel.insertMany(
      members,
      options || {},
    )) as unknown as GroupMember[];
  }
}
