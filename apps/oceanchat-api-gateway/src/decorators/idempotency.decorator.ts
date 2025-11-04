import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_OPTIONS_KEY = 'idempotency_options';

export interface IdempotencyMetadata {
  cacheTtl?: number; // in seconds
}

/**
 * Decorator to apply custom idempotency options to a route.
 * @param options - The idempotency options for this route.
 */
export const Idempotency = (options: IdempotencyMetadata) =>
  SetMetadata(IDEMPOTENCY_OPTIONS_KEY, options);
