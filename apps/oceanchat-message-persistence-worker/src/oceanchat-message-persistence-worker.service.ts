import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GroupMember, Message, OceanModel } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { ImOrchestrateEvent, SyncCursorReadEventDto } from '@ocean.chat/types';
import { Model, Types } from 'mongoose';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

interface PersistenceTask<T> {
  event: T;
  resolve: () => void;
  reject: (err: unknown) => void;
}

@Injectable()
export class OceanchatMessagePersistenceWorkerService
  implements OnModuleDestroy
{
  // Batching configuration
  private readonly MSG_BATCH_SIZE = 1; // TODO: The value was changed to 1 here to ensure immediate data entry. This is for calculating unread notifications (red dots) for online users.
  private readonly CURSOR_BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 10000;

  // Task buffers
  private msgBuffer: PersistenceTask<ImOrchestrateEvent>[] = [];
  private cursorBuffer: PersistenceTask<SyncCursorReadEventDto>[] = [];

  // Timers
  private msgTimer?: NodeJS.Timeout;
  private cursorTimer?: NodeJS.Timeout;

  // TODO: Do not reject model here
  constructor(
    @InjectModel(OceanModel.Message)
    private readonly messageModel: Model<Message>,
    @InjectModel(OceanModel.GroupMember)
    private readonly groupMemberModel: Model<GroupMember>,
    private readonly redisService: RedisService,
    @InjectPinoLogger('worker.persistence')
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy() {
    this.logger.info('Persistence service shutting down, clearing timers...');
    if (this.msgTimer) clearTimeout(this.msgTimer);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
  }

  /**
   * Buffers a message for persistence. Returns a promise that resolves only
   * when the message is successfully written to MongoDB.
   */
  async bufferMessageForPersistence(event: ImOrchestrateEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      this.msgBuffer.push({ event, resolve, reject });

      if (this.msgBuffer.length >= this.MSG_BATCH_SIZE) {
        void this.flushMessages();
      } else if (!this.msgTimer) {
        this.msgTimer = setTimeout(
          () => void this.flushMessages(),
          this.FLUSH_INTERVAL_MS,
        );
      }
    });
  }

  /**
   * Buffers a cursor update for dual-write persistence. Returns a promise that
   * resolves only when both Redis and MongoDB are updated.
   */
  async bufferCursorForPersistence(
    event: SyncCursorReadEventDto,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cursorBuffer.push({ event, resolve, reject });

      if (this.cursorBuffer.length >= this.CURSOR_BATCH_SIZE) {
        void this.flushCursors();
      } else if (!this.cursorTimer) {
        this.cursorTimer = setTimeout(
          () => void this.flushCursors(),
          this.FLUSH_INTERVAL_MS,
        );
      }
    });
  }

  private async flushMessages(): Promise<void> {
    if (this.msgTimer) {
      clearTimeout(this.msgTimer);
      this.msgTimer = undefined;
    }

    if (this.msgBuffer.length === 0) return;

    const batch = this.msgBuffer;
    this.msgBuffer = [];

    const bulkOps = batch.map((task) => ({
      insertOne: {
        document: {
          _id: new Types.ObjectId(),
          groupId: task.event.msgUp.groupId,
          content: task.event.msgUp?.content || '',
          u: {
            _id: task.event.userId,
            username: task.event.userId,
          },
          syncSeqId: task.event.syncSeqId,
          clientMsgId: task.event.msgUp?.clientMsgId,
          msgType: task.event.msgUp?.msgType,
          url: task.event.msgUp?.url,
          width: task.event.msgUp?.width,
          height: task.event.msgUp?.height,
          size: task.event.msgUp?.size,
          format: task.event.msgUp?.format,
          duration: task.event.msgUp?.duration,
          fileName: task.event.msgUp?.fileName,
          extension: task.event.msgUp?.extension,
          thumbnailUrl: task.event.msgUp?.thumbnailUrl,
        },
      },
    }));

    try {
      await this.messageModel.bulkWrite(bulkOps, { ordered: false });
      this.logger.debug(
        `Successfully persisted batch of ${batch.length} messages.`,
      );
      batch.forEach((t) => t.resolve());
    } catch (error: unknown) {
      this.handleBulkWriteError(error, batch, 'message');
    }
  }

  private async flushCursors(): Promise<void> {
    if (this.cursorTimer) {
      clearTimeout(this.cursorTimer);
      this.cursorTimer = undefined;
    }

    if (this.cursorBuffer.length === 0) return;

    const batch = this.cursorBuffer;
    this.cursorBuffer = [];

    // Local folding: Only the latest cursor for each (groupId, userId) is meaningful in a batch
    const foldedMap = new Map<
      string,
      PersistenceTask<SyncCursorReadEventDto>
    >();
    for (const task of batch) {
      const key = `${task.event.groupId}:${task.event.userId}`;
      const existing = foldedMap.get(key);
      if (
        !existing ||
        BigInt(task.event.syncSeqId) > BigInt(existing.event.syncSeqId)
      ) {
        if (existing) existing.resolve(); // Superseeded cursor is effectively processed
        foldedMap.set(key, task);
      } else {
        task.resolve(); // Older cursor is irrelevant
      }
    }

    const uniqueTasks = Array.from(foldedMap.values());
    const redisPipeline = this.redisService.getClient().pipeline();
    const mongoBulkOps: any[] = [];

    for (const task of uniqueTasks) {
      const { event } = task;
      redisPipeline.set(
        `cursor:read:${event.groupId}:${event.userId}`,
        event.syncSeqId,
      );
      mongoBulkOps.push({
        updateOne: {
          filter: { 'user._id': event.userId, groupId: event.groupId },
          update: { $max: { lastReadSeqId: event.syncSeqId } },
        },
      });
    }

    try {
      await Promise.all([
        redisPipeline.exec(),
        this.groupMemberModel.bulkWrite(mongoBulkOps, { ordered: false }),
      ]);
      this.logger.debug(
        `Successfully dual-wrote batch of ${uniqueTasks.length} cursors.`,
      );
      uniqueTasks.forEach((t) => t.resolve());
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to flush cursor batch.');
      uniqueTasks.forEach((t) => t.reject(error));
    }
  }

  private handleBulkWriteError<T>(
    error: unknown,
    batch: PersistenceTask<T>[],
    type: string,
  ): void {
    let isDuplicateError = false;
    let errorMessage: unknown = 'Unknown error';

    if (typeof error === 'object' && error !== null) {
      const errObj = error as Record<string, unknown>;
      errorMessage = errObj.message;

      const isMongoBulkWriteError =
        errObj.name === 'MongoBulkWriteError' ||
        errObj.name === 'BulkWriteError';
      const isOnlyDuplicateErrors =
        isMongoBulkWriteError &&
        Array.isArray(errObj.writeErrors) &&
        errObj.writeErrors.every(
          (e: unknown) =>
            typeof e === 'object' &&
            e !== null &&
            (e as Record<string, unknown>).code === 11000,
        );

      if (isOnlyDuplicateErrors || errObj.code === 11000) {
        isDuplicateError = true;
      }
    }

    if (isDuplicateError) {
      this.logger.warn(
        { err: errorMessage },
        `Duplicate keys detected in ${type} batch. Safe to resolve.`,
      );
      batch.forEach((t) => t.resolve());
    } else {
      this.logger.error(
        { err: error },
        `${type} BulkWrite failed. Rejecting batch for redelivery.`,
      );
      batch.forEach((t) => t.reject(error));
    }
  }
}
