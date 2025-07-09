import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingType =
  | 'string'
  | 'int'
  | 'boolean'
  | 'code'
  | 'color'
  | 'action'
  | 'asset';

export type SettingValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | any[];

@Schema({ timestamps: true })
export class Setting extends Document {
  @Prop({ required: true })
  type: SettingType; // Type of the setting, e.g., string, int, boolean, etc.

  @Prop({ default: false })
  public: boolean; // Whether the setting is public or private. public field is used to determine whether the setting is public or private. If it is public, it can be accessed by anyone, otherwise, it can only be accessed by the special role.

  @Prop({ required: false })
  group?: string; // Group to which the setting belongs, e.g., 'general', etc.

  @Prop({ required: false })
  i18nLabel: string; // Internationalization label for the setting, used for display purposes.

  @Prop({ type: 'Mixed' })
  value: SettingValue;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
