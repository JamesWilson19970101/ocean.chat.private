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
    return this.model.find(filter).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: Record<string, unknown>,
  ): Promise<UpdateWriteOpResult> {
    return this.model.updateOne(filter, update, options).exec();
  }

  async findById(id: any): Promise<Partial<T> | null> {
    return this.model.findById(id).exec();
  }

  async create(entity: Partial<T>): Promise<T> {
    const model = new this.model(entity);
    return model.save();
  }

  async update(
    id: any,
    entity: UpdateQuery<Partial<T>>,
  ): Promise<Partial<T> | null> {
    return this.model.findByIdAndUpdate(id, entity, { new: true }).exec();
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
