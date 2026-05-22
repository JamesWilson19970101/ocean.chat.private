import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OceanModel, Message } from '@ocean.chat/models';
import { Model, Types } from 'mongoose';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ImOrchestrateEvent } from '@ocean.chat/types';
import { JsMsg, StringCodec } from 'nats';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

@Injectable()
export class OceanchatMessagePersistenceWorkerService {
  private readonly sc = StringCodec();

  constructor(
    @InjectModel(OceanModel.Message)
    private readonly messageModel: Model<Message>,
    @InjectPinoLogger('worker.persistence')
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Processes a batch of NATS messages, bulk inserts them into MongoDB,
   * and explicitly ACKs them upon success.
   */
  async processBatch(messages: JsMsg[]): Promise<void> {
    if (messages.length === 0) return;

    const bulkOps: any[] = [];
    const validMsgs: { msg: JsMsg; event: ImOrchestrateEvent }[] = [];

    for (const m of messages) {
      try {
        const raw = this.sc.decode(m.data);
        const parsed = JSON.parse(raw) as unknown;
        const rawPayload =
          parsed && typeof parsed === 'object' && 'data' in parsed
            ? (parsed as { data: unknown }).data
            : parsed;

        const event = plainToInstance(ImOrchestrateEvent, rawPayload);
        await validateOrReject(event, { whitelist: true, forbidNonWhitelisted: true });

        validMsgs.push({ msg: m, event });

        const isGroup = event.msgUp.groupId.startsWith('G');

        // Create Mongoose BulkOperation (InsertOne)
        bulkOps.push({
          insertOne: {
            document: {
              _id: new Types.ObjectId(),
              rid: event.msgUp.groupId, // In Ocean Chat, groupId is mapped to room id (rid)
              msg: event.msgUp.content || '',
              u: {
                _id: event.userId,
                username: event.userId,
              },
              t: undefined, // Normal message doesn't have a specific type string
              syncSeqId: event.syncSeqId, // Crucial cursor
              clientMsgId: event.msgUp.clientMsgId, // Used for idempotent writes
              msgType: event.msgUp.msgType, // Application layer message type
              unread: true,
            },
          },
        });
      } catch (err) {
        this.logger.error({ err, subject: m.subject }, 'Failed to parse/validate message. Discarding poison message.');
        m.ack(); // Poison message, discard
      }
    }

    if (bulkOps.length === 0) return;

    try {
      // Execute BulkWrite
      await this.messageModel.bulkWrite(bulkOps, { ordered: false });

      // Explicitly ACK all messages in the batch after successful DB insertion
      for (const item of validMsgs) {
        item.msg.ack();
      }

      this.logger.debug(`Successfully persisted ${bulkOps.length} messages.`);
    } catch (error: any) {
      // Handle MongoBulkWriteError properly.
      // It contains a writeErrors array. If all errors are duplicate keys (11000), we can ACK.
      const isMongoBulkWriteError = error.name === 'MongoBulkWriteError' || error.name === 'BulkWriteError';
      const isOnlyDuplicateErrors = isMongoBulkWriteError && 
        Array.isArray(error.writeErrors) && 
        error.writeErrors.every((e: any) => e.code === 11000);

      if (isOnlyDuplicateErrors || error.code === 11000) {
        this.logger.warn({ err: error.message }, 'Duplicate key detected during bulk insert. Acking batch to prevent loop.');
        for (const item of validMsgs) {
          item.msg.ack();
        }
      } else {
        this.logger.error({ err: error }, 'BulkWrite failed. NAKing batch to trigger redelivery.');
        // NAK the batch so NATS will redeliver
        for (const item of validMsgs) {
          item.msg.nak();
        }
      }
    }
  }
}
