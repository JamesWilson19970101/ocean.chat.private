import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Sequence } from '../entities/sequence.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class SequenceRepository extends BaseRepository<Sequence> {
  constructor(
    @InjectModel(Sequence.name) private readonly sequenceModel: Model<Sequence>,
  ) {
    super(sequenceModel);
  }

  /**
   * Atomically allocates a new sequence segment.
   * Utilizes MongoDB's row-level lock via $inc.
   *
   * @param key The business entity or session identifier.
   * @param step The number of sequence IDs to allocate in this segment.
   * @returns The new upper limit (max) after allocation.
   */
  async allocateSegment(key: string, step: number): Promise<bigint> {
    const result = await this.sequenceModel
      .findOneAndUpdate(
        { _id: key },
        { $inc: { max: step } },
        { new: true, upsert: true }, // Create if it doesn't exist, return new document
      )
      .lean()
      .exec();

    return BigInt(result.max);
  }
}
