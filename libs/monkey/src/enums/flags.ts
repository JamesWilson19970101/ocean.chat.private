/**
 * Monkey Protocol Bitmask Flags.
 * Encoded in the `flags` byte of the header to control protocol features.
 */
export const MonkeyFlags = {
  /** No flags set. */
  NONE: 0x00,
  /** Bit 0: Receiver must explicitly send an ACK. */
  REQUIRE_ACK: 0x01,
  /** Bit 1: Payload is compressed (e.g., Zstd or Gzip). */
  COMPRESSED: 0x02,
  /** Bit 2: Payload is encrypted (e.g., AES-GCM). */
  ENCRYPTED: 0x04,
  /** Bit 3: No retry for extremely time-sensitive signals (e.g., "typing..."). */
  NO_RETRY: 0x08,
} as const;

/**
 * Checks if a specific flag is set in the flags bitmask.
 *
 * @param currentFlags The current flags byte value.
 * @param flag The flag bitmask to check for.
 * @returns True if the flag is set.
 */
export const hasFlag = (currentFlags: number, flag: number): boolean => {
  return (currentFlags & flag) === flag;
};

/**
 * Sets a specific flag in the flags bitmask.
 *
 * @param currentFlags The current flags byte value.
 * @param flag The flag bitmask to set.
 * @returns The new flags byte value.
 */
export const setFlag = (currentFlags: number, flag: number): number => {
  return currentFlags | flag;
};

/**
 * Clears a specific flag from the flags bitmask.
 *
 * @param currentFlags The current flags byte value.
 * @param flag The flag bitmask to clear.
 * @returns The new flags byte value.
 */
export const clearFlag = (currentFlags: number, flag: number): number => {
  return currentFlags & ~flag;
};
