import { FilterQuery, UpdateQuery } from 'mongoose';

export interface IRepository<T> {
  find(filter: FilterQuery<T>): Promise<T[]>;
  findById(id: any): Promise<T | null>;
  create(entity: Partial<T>): Promise<T>;
  update(id: any, entity: UpdateQuery<T>): Promise<T | null>;
  delete(id: any): Promise<boolean>;
}
