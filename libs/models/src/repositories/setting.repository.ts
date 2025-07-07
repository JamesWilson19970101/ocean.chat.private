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
}
