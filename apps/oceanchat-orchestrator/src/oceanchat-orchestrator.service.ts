import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@ocean.chat/redis';
import {
  DevicePresence,
  PresenceDeviceStatus,
  VendorType,
} from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class OceanchatOrchestratorService {
  constructor(
    private readonly redisService: RedisService,
    @InjectPinoLogger(OceanchatOrchestratorService.name)
    private readonly logger: PinoLogger,
    @Inject('GROUP_SERVICE') private readonly groupClient: ClientProxy,
  ) {}

  /**
   * Fetches the recipients for a given group or P2P chat.
   *
   * TODO: Architectural Optimization for Large Groups (10k+ members)
   * Fetching 10,000 users via RPC for EVERY message is an anti-pattern (Fan-out Avalanche).
   * Real implementation should adopt the following strategies:
   * 1. Fast Path: Read from Redis `SMEMBERS group:{groupId}:members` directly (maintained by Group service).
   * 2. Super Large Groups (>2000): Do not fetch all members. Route the message to `GROUP_HYBRID` broadcast stream,
   *    and let gateways locally intersect with their active connections.
   * 3. Offline Degradation: For super large groups, only fetch users who are explicitly @mentioned for offline APNs/FCM push.
   */
  async getRecipients(groupId: string, senderId: string): Promise<string[]> {
    this.logger.debug(`Fetching members for group ${groupId} via RPC`);
    try {
      // TODO: Standardized error
      // How can the front-end detect related errors? Is the only solution to resend the request after a timeout?
      const members = await firstValueFrom(
        this.groupClient
          .send<string[]>('group.query.members', { groupId })
          .pipe(
            timeout(5000), // 5 seconds timeout
          ),
      );
      // Ensure sender is included so the orchestrator can filter them out properly
      if (!members.includes(senderId)) {
        members.push(senderId);
      }
      return members;
    } catch (err) {
      this.logger.error(
        { err, groupId },
        'Failed to fetch group members via RPC',
      );
      throw err;
    }
  }

  /**
   * Retrieves the presence status for a batch of users using a Redis Pipeline.
   */
  async evaluatePresenceBatch(
    userIds: string[],
  ): Promise<Map<string, PresenceDeviceStatus>> {
    const result = new Map<string, PresenceDeviceStatus>();
    if (!userIds || userIds.length === 0) return result;

    // Deduplicate userIds to avoid redundant Redis queries
    // TODO: Ten thousand users is too many; this issue must be addressed later.
    // Even using in-memory data structures, 10,000 users is too many.
    const uniqueUserIds = Array.from(new Set(userIds));

    // 2. Chunk the pipeline to prevent blocking Redis and memory bloat
    const chunkSize = 500;
    for (let i = 0; i < uniqueUserIds.length; i += chunkSize) {
      const chunk = uniqueUserIds.slice(i, i + chunkSize);
      const pipeline = this.redisService.getClient().pipeline();

      chunk.forEach((uid) => {
        // Presence service stores devices as Hash: user:routing:{userId} -> { deviceId: JSON.stringify(DevicePresence) }
        pipeline.hgetall(`user:routing:${uid}`);
      });

      try {
        const execResults = await pipeline.exec();
        if (!execResults) {
          // Fail-safe: mark the failed chunk as offline to gracefully degrade to push notifications
          chunk.forEach((uid) =>
            result.set(uid, { userId: uid, isOnline: false, devices: [] }),
          );
          continue;
        }

        execResults.forEach((res, index) => {
          const [err, hash] = res as [
            Error | null,
            Record<string, string> | null,
          ];
          const userId = chunk[index];
          const status: PresenceDeviceStatus = {
            userId,
            isOnline: false,
            devices: [],
          };

          if (!err && hash && Object.keys(hash).length > 0) {
            for (const [deviceId, deviceJson] of Object.entries(hash)) {
              try {
                const deviceData = JSON.parse(deviceJson) as DevicePresence;
                // 3. Robustness: validate gatewayId to prevent routing to black holes (im.down.node.undefined)
                if (deviceData && deviceData.gatewayId) {
                  status.devices.push(deviceData);
                } else {
                  this.logger.warn(
                    { userId, deviceId },
                    'Presence data missing critical gatewayId, skipping',
                  );
                }
              } catch (parseErr) {
                this.logger.warn(
                  { parseErr, deviceId, userId },
                  'Failed to parse device presence JSON',
                );
              }
            }
            status.isOnline = status.devices.length > 0;
          }

          result.set(userId, status);
        });
      } catch (err) {
        this.logger.error(
          { err },
          'Failed to execute Redis pipeline for presence evaluation chunk',
        );
        // Fail-safe: populate empty offline status for the chunk if the pipeline throws
        chunk.forEach((uid) =>
          result.set(uid, { userId: uid, isOnline: false, devices: [] }),
        );
      }
    }

    return result;
  }

  /**
   * Calculates the exact unread badge count for a user in a group
   * using the Redis ZSET sliding window strategy in O(log(N)) time.
   */
  async calculateBadge(userId: string, groupId: string): Promise<number> {
    try {
      // 1. Fetch the user's latest read cursor for this group
      // E.g., stored by the CURSOR_STATE pipeline
      const cursorKey = `cursor:read:${groupId}:${userId}`;
      // TODO: If can not get data from redis, then get data from mongodb
      const lastReadStr = await this.redisService.get(cursorKey);
      const lastReadSeqId = lastReadStr ? lastReadStr : '0';

      // 2. Count messages in the ZSET that are newer than the cursor
      const zsetKey = `group:msg:${groupId}`;

      // ZCOUNT group:msg:G1001 (lastReadSeqId +inf
      // Redis counts items with score strictly greater than lastReadSeqId up to positive infinity
      const unreadCount = await this.redisService
        .getClient()
        .zcount(zsetKey, `(${lastReadSeqId}`, '+inf');

      return unreadCount;
    } catch (err) {
      this.logger.error(
        { err, userId, groupId },
        'Failed to calculate badge via ZCOUNT',
      );
      return 1; // Fallback to 1
    }
  }

  /**
   * Mock method for fetching offline device push tokens.
   * In a real implementation, this would query a device registry or user service database.
   */
  getOfflineDevices(
    userIds: string[],
  ): Map<string, { vendor: VendorType; deviceToken: string }[]> {
    const result = new Map<
      string,
      { vendor: VendorType; deviceToken: string }[]
    >();
    for (const uid of userIds) {
      // Mock an APNS device for every offline user
      // TODO: Currently, the logic for offline push notifications is not yet being implemented.
      result.set(uid, [
        { vendor: VendorType.APNS, deviceToken: `mock-token-${uid}` },
      ]);
    }
    return result;
  }
}
