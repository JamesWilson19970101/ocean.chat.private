import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseRepository } from '../base.repository';
import { Setting } from '../entities';

@Injectable()
export class SettingsRepository extends BaseRepository<Setting> {
  constructor(@InjectModel(Setting.name) private settingModel: Model<Setting>) {
    super(settingModel);
  }

  /**
   * Finds a setting by its key.
   * @param key setting key
   * @returns The setting document that matches the provided key, or null if no such document exists.
   */
  async findByKey(key: string): Promise<Setting | null> {
    return this.model.findOne({ _id: key }).exec();
  }

  /**
   * Upserts a setting by its key. If a setting with the specified key exists, it updates its value; otherwise, it creates a new setting with the provided key and value.
   * @param key setting key
   * @param value setting value
   * @returns The upserted setting document.
   */
  async upsert(key: string, value: Setting['value']): Promise<Setting> {
    return this.model
      .findOneAndUpdate({ _id: key }, { value }, { upsert: true, new: true })
      .exec();
  }

  /**
   * Creates a setting document if one with the same _id does not already exist.
   * If a document with the same _id exists, it returns the existing document without making any changes.
   * This is useful for idempotent initialization of default settings.
   * @param setting The setting data to create.
   * @returns The created or existing setting document.
   */
  async createIfNotExists(setting: Partial<Setting>): Promise<Setting> {
    return this.model
      .findOneAndUpdate(
        { _id: setting._id },
        { $setOnInsert: setting },
        { upsert: true, new: true },
      )
      .exec();
  }
}
