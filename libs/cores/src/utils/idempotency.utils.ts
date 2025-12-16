/**
 * Generates the Redis key for an idempotency key.
 * @param idempotencyKey The idempotency key from the request header.
 * @returns The formatted Redis key, e.g., "idempotency:some-uuid-key".
 */
export const getIdempotencyRedisKey = (idempotencyKey: string): string =>
  `idempotency:${idempotencyKey}`;
