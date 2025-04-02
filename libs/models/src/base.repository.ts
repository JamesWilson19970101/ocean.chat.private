import { Injectable } from '@nestjs/common';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';

import { IRepository } from './interfaces/repository.interface';

@Injectable()
export abstract class BaseRepository<T> implements IRepository<T> {
  protected readonly model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async find(filter: FilterQuery<T>): Promise<T[]> {
    return this.model.find(filter).exec();
  }

  async findById(id: any): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async create(entity: T): Promise<T> {
    return this.model.create(entity);
  }

  async update(id: any, entity: UpdateQuery<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, entity, { new: true }).exec();
  }

  async delete(id: any): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
