/**
 * Interface for the Distributed ID Generator (SyncSeqId)
 */
export interface ISyncSeqIdGenerator {
  /**
   * Generates a strictly monotonically increasing 64-bit sequence number (SyncSeqId).
   * Returns a string to prevent precision loss in JavaScript and ensure safe cross-language transmission.
   *
   * @param key The identifier for the business entity or session (e.g., '12345' for group, '678' for user).
   * @returns A promise that resolves to a monotonically increasing numeric string.
   */
  generateSyncSeqId(key: string): Promise<string>;
}
