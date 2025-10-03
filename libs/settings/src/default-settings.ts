import type { Setting, SettingType } from '@ocean.chat/models';

/**
 * @interface DefaultSetting
 * @description Defines the structure for a default setting entry.
 */
export interface DefaultSetting {
  _id: string;
  value: Setting['value'];
  type: SettingType;
  group: string;
  i18nLabel: string;
  public?: boolean;
}

/**
 * @const defaultSettings
 * @description An array containing all default settings to be initialized in the database.
 */
export const defaultSettings: DefaultSetting[] = [
  // username policy
  {
    _id: 'Accounts_Username_MinLength',
    value: 3,
    type: 'int',
    group: 'Accounts',
    i18nLabel: 'Accounts_Username_MinLength',
  },
  {
    _id: 'Accounts_Username_MaxLength',
    value: 20,
    type: 'int',
    group: 'Accounts',
    i18nLabel: 'Accounts_Username_MaxLength',
  },
  {
    _id: 'Accounts_Username_Regex',
    value: '^[a-zA-Z0-9_.-]+$',
    type: 'string',
    group: 'Accounts',
    i18nLabel: 'Accounts_Username_Regex',
  },
  // password policy
  {
    _id: 'Accounts_Password_MinLength',
    value: 6,
    type: 'int',
    group: 'Accounts',
    i18nLabel: 'Accounts_Password_MinLength',
  },
  {
    _id: 'Accounts_Password_RequireDigit',
    value: true,
    type: 'boolean',
    group: 'Accounts',
    i18nLabel: 'Accounts_Password_RequireDigit',
  },
  {
    _id: 'Accounts_Password_RequireLowercase',
    value: true,
    type: 'boolean',
    group: 'Accounts',
    i18nLabel: 'Accounts_Password_RequireLowercase',
  },
  {
    _id: 'Accounts_Password_RequireUppercase',
    value: true,
    type: 'boolean',
    group: 'Accounts',
    i18nLabel: 'Accounts_Password_RequireUppercase',
  },
  {
    _id: 'Accounts_Password_RequireSpecialChar',
    value: false,
    type: 'boolean',
    group: 'Accounts',
    i18nLabel: 'Accounts_Password_RequireSpecialChar',
  },
];
