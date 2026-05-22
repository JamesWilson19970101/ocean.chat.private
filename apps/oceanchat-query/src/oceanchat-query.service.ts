import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { Message, OceanModel } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { SyncMessageItem, SyncMessagesResponse } from '@ocean.chat/types';
import { Model } from 'mongoose';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class OceanchatQueryService {
  constructor(
    @InjectModel(OceanModel.Message)
    private readonly messageModel: Model<Message>,
    private readonly redisService: RedisService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger(OceanchatQueryService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Fetches incremental messages using Redis Singleflight caching.
   * Protects MongoDB from thundering herd during massive group chat syncs.
   */
  async syncMessages(
    groupId: string,
    syncSeqId: string,
    userId: string,
  ): Promise<SyncMessagesResponse> {
    try {
      // Security: Validate if the user is a member of the group before allowing them to fetch messages.
      // This is a placeholder for a real RPC call to `oceanchat-group` service or checking the `GroupMember` DB.
      const isMember = await this.checkUserMembership(groupId, userId);
      if (!isMember) {
        throw new DomainException(
          this.i18nService.translate('FORBIDDEN'),
          ErrorCodes.UNAUTHORIZED, // or FORBIDDEN if it exists
          403,
          { originalMessage: 'User is not a member of the group' },
        );
      }

      // Cache key includes groupId and the exact syncSeqId
      const cacheKey = `sync:msg:${groupId}:${syncSeqId}`;

      // Use Singleflight pattern via Redis cache
      const cachedResult =
        await this.redisService.getOrSet<SyncMessagesResponse>(
          cacheKey,
          async () => {
            this.logger.debug(
              `[Cache Miss] Fetching from MongoDB for ${cacheKey}`,
            );

            // Fetch from MongoDB
            const messages = await this.messageModel
              .find({
                rid: groupId,
                syncSeqId: { $gt: syncSeqId }, // Fetch only strictly newer messages
              })
              .sort({ syncSeqId: 1 })
              .limit(50) // Max 50 messages per sync page
              .lean()
              .exec();

            const hasMore = messages.length === 50;

            const mappedMessages: SyncMessageItem[] = messages.map((msg) => ({
              clientMsgId: msg.clientMsgId || '',
              groupId: String(msg.rid),
              msgType: msg.msgType || 0, // Fallback to 0 (TEXT)
              content: msg.msg,
              syncSeqId: msg.syncSeqId || '',
              senderId: String(msg.u._id),
              createdAt: (msg as any).createdAt
                ? new Date((msg as any).createdAt).toISOString()
                : new Date().toISOString(),
            }));

            return {
              messages: mappedMessages,
              hasMore,
            };
          },
          {
            ttl: 3, // Very short TTL (3 seconds) just enough to absorb the thundering herd
            lockTtl: 5,
          },
        );

      let response: SyncMessagesResponse;
      if (typeof cachedResult === 'string') {
        const rawPayload = JSON.parse(cachedResult);
        // Validating untrusted data from cache to prevent poison cache crashes
        // For simplicity, we just type cast it here, but in production we should use validateOrReject
        // We'll trust the Redis output structure since we set it, but still parse safely
        response = rawPayload as SyncMessagesResponse;
      } else if (cachedResult !== null) {
        response = cachedResult;
      } else {
        response = { messages: [], hasMore: false };
      }

      this.logger.info(
        { userId, groupId, syncSeqId, returnedCount: response.messages.length },
        'Successfully synced messages',
      );

      return response;
    } catch (error) {
      if (error instanceof DomainException) throw error;

      this.logger.error(
        { err: error, groupId, syncSeqId, userId },
        'Failed to sync messages',
      );
      throw new InfrastructureException(
        this.i18nService.translate('SERVICE_ERROR'),
        ErrorCodes.SERVICE_ERROR,
        500,
        false,
        { cause: error },
      );
    }
  }

  /**
   * Mock method to check if the user is a member of the requested group.
   */
  private async checkUserMembership(
    groupId: string,
    userId: string,
  ): Promise<boolean> {
    // Mocking an RPC call that validates membership.
    // E.g., const isMember = await this.groupClient.send({ cmd: 'check_membership' }, { groupId, userId }).toPromise();
    this.logger.debug({ groupId, userId }, 'Mock membership check executed');
    return true; // Always true for now
  }
}
