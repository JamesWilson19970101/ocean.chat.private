import { Injectable } from '@nestjs/common';

type SettingValue = string; // Define the type of value you expect

@Injectable()
export class SettingsService {
  async addSetting(
    _id: string,
    value: SettingValue,
    { group, ...options }: Record<string, any> = {},
  ): Promise<void> {
    if (!_id || !value) {
      throw new Error('Setting ID and value are required');
    }

    const setting = {
      _id, // Unique identifier for the setting
      group: group || 'default', // Default group if not provided
      defaultValue: value, // Assuming value is the default value
      source: 'defaultValue',
      i18nlabel: _id, // Using _id as the i18n label for simplicity
      public: options.public || false, // Default to false if not provided
      type: options.type || 'string', // Default type is 'string'
    };

    
  }
}
