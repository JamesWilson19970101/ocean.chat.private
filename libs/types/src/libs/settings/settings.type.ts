/**
 * Defines the various types of settings supported by the system.
 * This determines how a setting is rendered in the UI (e.g., input, switch, dropdown) and validated on the backend.
 */
export type SettingType =
  | 'string'
  | 'timezone'
  | 'relativeUrl'
  | 'password'
  | 'int'
  | 'boolean'
  | 'select'
  | 'multiSelect'
  | 'language'
  | 'color'
  | 'font'
  | 'code'
  | 'action'
  | 'asset'
  | 'roomPick'
  | 'group'
  | 'date'
  | 'lookup';

/**
 * Defines the possible types for a setting's value.
 * This is a union type to support the diverse data storage needs of different `SettingType`s.
 */
export type SettingValue =
  | string
  | number
  | boolean
  | Date
  | Record<string, unknown>
  | any[];
