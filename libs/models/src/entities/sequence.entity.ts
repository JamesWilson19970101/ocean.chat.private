import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SequenceDocument = Sequence & Document;

/**
 * Sequence model for the segment-based pre-allocation distributed ID generator.
 */
@Schema({
  collection: 'sequences',
  timestamps: true,
  versionKey: false,
  _id: false,
})
export class Sequence extends Document {
  /**
   * The unique identifier for the business entity or session (e.g., 'group_chat_123').
   */
  @Prop({ type: String, required: true })
  declare _id: string;

  /**
   * The current upper limit (max allocated ID) for this specific key.
   * Uses BigInt to support strict 64-bit integers and prevent JavaScript precision loss.
   */
  @Prop({ type: BigInt, required: true, default: 0n })
  max: bigint;
}

export const SequenceSchema = SchemaFactory.createForClass(Sequence);
