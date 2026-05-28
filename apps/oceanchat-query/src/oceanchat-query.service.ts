import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  DomainException,
  ErrorCodes,
  InfrastructureException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { MessageRepository } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { SyncMessageItem, SyncMessagesResponse } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class OceanchatQueryService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly redisService: RedisService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger(OceanchatQueryService.name)
    private readonly logger: PinoLogger,
    @Inject('GROUP_SERVICE') private readonly groupClient: ClientProxy,
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
      const isMember = await this.checkUserMembership(groupId, userId);
      if (!isMember) {
        throw new DomainException(
          this.i18nService.translate('FORBIDDEN'),
          ErrorCodes.UNAUTHORIZED, // or FORBIDDEN if it exists
          403,
          { originalMessage: 'User is not a member of this group' },
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

            const limit = 50;
            // Fetch from MongoDB
            const messages = await this.messageRepository.findMessageBySeqId(
              groupId,
              syncSeqId,
              limit,
            );

            const hasMore = messages.length === limit;

            const mappedMessages: SyncMessageItem[] = messages.map((msg) => ({
              clientMsgId: msg.clientMsgId || '',
              groupId: String(msg.groupId),
              msgType: msg.msgType || 0, // Fallback to 0 (TEXT)
              content: msg.content,
              syncSeqId: msg.syncSeqId || '',
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

      // redisService.getOrSet already handles JSON parsing and returns the object or null.
      const response: SyncMessagesResponse = cachedResult || {
        messages: [],
        hasMore: false,
      };

      this.logger.info(
        { userId, groupId, syncSeqId, returnedCount: response.messages.length },
        'Successfully synced messages',
      );

      return response;
    } catch (error) {
      if (error instanceof DomainException) throw error;

      throw new InfrastructureException(
        this.i18nService.translate('SERVICE_ERROR', { method: 'syncMessages' }),
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
    try {
      console.log('groupId is: ', groupId);
      console.log('userId is: ', userId);
      this.logger.debug(
        { groupId, userId },
        'Checking group membership via RPC',
      );
      const members = await firstValueFrom(
        this.groupClient
          .send<string[]>('group.query.members', { groupId })
          .pipe(timeout(5000)),
      );
      return members.includes(userId);
    } catch (error) {
      this.logger.error(
        { err: error, groupId, userId },
        'Failed to check membership via RPC',
      );
      return false; // Fail secure: if RPC fails, deny access
    }
  }
}
