import { Injectable } from '@nestjs/common';
import { RedisService } from '@ocean.chat/redis';
import {
  DevicePresence,
  PresenceDeviceStatus,
  VendorType,
} from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class OceanchatOrchestratorService {
  constructor(
    private readonly redisService: RedisService,
    @InjectPinoLogger(OceanchatOrchestratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Mock method for fetching group members.
   * In a real implementation, this would use an injected gRPC client to call OceanchatGroupService.
   */
  async getRecipients(groupId: string, senderId: string): Promise<string[]> {
    if (groupId.startsWith('G')) {
      // Mock returning a few users for a group
      // Imagine RPC call: await this.groupClient.getGroupMembers({ groupId })
      this.logger.debug(`[Mock] Fetching members for group ${groupId}`);
      // Return 3 mock users including the sender to test different states
      return [senderId, 'user-A', 'user-B'];
    } else {
      // P2P chat, return just the two participants
      // Usually, p2p groupId contains both user ids or we query the relations service
      this.logger.debug(`[Mock] Resolving P2P recipients for ${groupId}`);
      return [senderId, 'user-B'];
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

    const pipeline = this.redisService.getClient().pipeline();
    userIds.forEach((uid) => {
      // Assume presence service stores devices as Hash: presence:{userId} -> { deviceId: JSON.stringify(DevicePresence) }
      pipeline.hgetall(`presence:${uid}`);
    });

    try {
      const execResults = await pipeline.exec();
      if (!execResults) return result;

      execResults.forEach((res, index) => {
        const [err, hash] = res as [
          Error | null,
          Record<string, string> | null,
        ];
        const userId = userIds[index];
        const status: PresenceDeviceStatus = {
          userId,
          isOnline: false,
          devices: [],
        };

        if (!err && hash && Object.keys(hash).length > 0) {
          for (const [deviceId, deviceJson] of Object.entries(hash)) {
            try {
              const deviceData = JSON.parse(deviceJson) as DevicePresence;
              status.devices.push(deviceData);
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
        'Failed to execute Redis pipeline for presence evaluation',
      );
    }

    return result;
  }

  /**
   * Mock method for fetching offline device push tokens.
   * In a real implementation, this would query a device registry or user service database.
   */
  async getOfflineDevices(
    userIds: string[],
  ): Promise<Map<string, { vendor: VendorType; deviceToken: string }[]>> {
    const result = new Map<
      string,
      { vendor: VendorType; deviceToken: string }[]
    >();
    for (const uid of userIds) {
      // Mock an APNS device for every offline user
      result.set(uid, [
        { vendor: VendorType.APNS, deviceToken: `mock-token-${uid}` },
      ]);
    }
    return result;
  }
}
