import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

/**
 * @class Setting
 * @description Mongoose entity representing a single configuration item in the system.
 * Each document is an individual setting.
 * @extends Document
 */
@Schema({ timestamps: true })
export class Setting extends Document {
  /**
   * The type of the setting, which determines its value format and UI rendering.
   * @example 'string', 'boolean', 'int'
   */
  @Prop({ required: true })
  type: SettingType;

  /**
   * Marks whether the setting is public.
   * Public settings can be queried by regular users via API, while non-public ones require specific permissions.
   * @default false
   */
  @Prop({ default: false })
  public: boolean;

  /**
   * The ID of the group this setting belongs to.
   * Used to organize related settings together in the UI.
   * @example 'General', 'Accounts', 'File_Upload'
   */
  @Prop({ required: false })
  group?: string;

  /**
   * The display label for the setting, usually an i18n key.
   * Used for display purposes in the user interface.
   * @example 'FileUpload_Enabled'
   */
  @Prop({ required: true })
  i18nLabel: string;

  /**
   * A detailed description for the setting, usually an i18n key.
   * Can be displayed as a tooltip or help text in the UI.
   */
  @Prop({ required: false })
  i18nDescription?: string;

  /**
   * The current value of the setting.
   * Its type is dynamic, as defined by `SettingValue`.
   */
  @Prop({ type: 'Mixed' })
  value: SettingValue;

  /**
   * The default value provided by the package or system.
   * Useful for when a user wants to reset the setting to its default state.
   */
  @Prop({ type: 'Mixed' })
  packageValue: SettingValue;

  /**
   * Whether the setting is hidden from the UI.
   * Can be used for feature flagging or internal testing.
   * @default false
   */
  @Prop({ default: false })
  hidden: boolean;

  /**
   * Whether the setting is read-only.
   * If `true`, users cannot modify this setting's value in the UI.
   * @default false
   */
  @Prop({ default: false })
  readonly: boolean;

  /**
   * Marks if this setting contains sensitive information (e.g., API keys, passwords).
   * Values for settings marked as `secret` should be masked or omitted in API responses and logs.
   * @default false
   */
  @Prop({ default: false })
  secret: boolean;

  /**
   * An alert or tip to display alongside this setting in the UI.
   * Can be used to warn users about the implications of changing the setting.
   */
  @Prop({ required: false })
  alert?: string;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
