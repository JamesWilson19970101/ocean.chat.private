import { Injectable } from '@nestjs/common';
import { Document, FilterQuery, Model, UpdateQuery } from 'mongoose';

import { IRepository } from './interfaces/repository.interface';

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

  /**
   * This method retrieves the name of the collection that the model is associated with.
   * @returns The name of the collection associated with the model.
   */
  getCollectionName(): string {
    return this.model.collection.name;
  }
}
