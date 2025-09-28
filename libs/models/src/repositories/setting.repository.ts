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
    return this.model.findOne({ key }).exec();
  }

  /**
   * Upserts a setting by its key. If a setting with the specified key exists, it updates its value; otherwise, it creates a new setting with the provided key and value.
   * @param key setting key
   * @param value setting value
   * @returns The upserted setting document.
   */
  async upsert(key: string, value: Setting['value']): Promise<Setting> {
    return this.model
      .findOneAndUpdate({ key }, { value }, { upsert: true, new: true })
      .exec();
  }
}
