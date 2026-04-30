import { Injectable } from '@nestjs/common';
import {
  Document,
  FilterQuery,
  Model,
  UpdateQuery,
  UpdateWriteOpResult,
} from 'mongoose';

import { IRepository } from '../interfaces/repository.interface';

@Injectable()
export abstract class BaseRepository<T extends Document>
  implements IRepository<T>
{
  protected readonly model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async find(filter: FilterQuery<T>): Promise<T[]> {
    return (await this.model.find(filter).lean().exec()) as unknown as T[];
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return (await this.model
      .findOne(filter)
      .lean()
      .exec()) as unknown as T | null;
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: Record<string, unknown>,
  ): Promise<UpdateWriteOpResult> {
    return await this.model.updateOne(filter, update, options).exec();
  }

  async findById(id: any): Promise<Partial<T> | null> {
    return (await this.model.findById(id).lean().exec()) as unknown as T | null;
  }

  async create(entity: Partial<T>): Promise<T> {
    const model = new this.model(entity);
    const saved = await model.save();
    return saved.toObject() as unknown as T;
  }

  async update(
    id: any,
    entity: UpdateQuery<Partial<T>>,
  ): Promise<Partial<T> | null> {
    return (await this.model
      .findByIdAndUpdate(id, entity, { new: true })
      .lean()
      .exec()) as unknown as Partial<T> | null;
  }

  async delete(id: any): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async deleteMany(filter: FilterQuery<T>): Promise<number> {
    const result = await this.model.deleteMany(filter).exec();
    return result.deletedCount;
  }

  /**
   * This method retrieves the name of the collection that the model is associated with.
   * @returns The name of the collection associated with the model.
   */
  getCollectionName(): string {
    return this.model.collection.name;
  }
}
