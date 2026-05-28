import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Message } from '../entities';
import { BaseRepository } from './base.repository';

@Injectable()
export class MessageRepository extends BaseRepository<Message> {
  constructor(@InjectModel(Message.name) private messageModel: Model<Message>) {
    super(messageModel);
  }

  // TODO: I'm too tired, so later design return type
  async findMessageBySeqId(
    groupId: string,
    syncSeqId: string,
    limit: number = 50,
  ): Promise<Message[]> {
    return this.find(
      {
        groupId: groupId,
        syncSeqId: { $gt: syncSeqId }, // Fetch only strictly newer messages
      },
      null, // projection
      { limit, sort: { syncSeqId: 1 } }, // Sort by seqId ascending to get the oldest unread messages first
    );
  }
}
