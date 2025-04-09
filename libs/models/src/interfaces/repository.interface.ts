import { FilterQuery, UpdateQuery } from 'mongoose';

export interface IRepository<T> {
  find(filter: FilterQuery<T>): Promise<Partial<T>[]>;
  findById(id: string): Promise<Partial<T> | null>;
  create(entity: Partial<T>): Promise<Partial<T>>;
  update(
    id: string,
    entity: UpdateQuery<Partial<T>>,
  ): Promise<Partial<T> | null>;
  delete(id: string): Promise<boolean>;
}
