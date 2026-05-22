import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { IdGeneratorService } from '@ocean.chat/id-generator';
import { MonkeyCmd, MsgUpAck } from '@ocean.chat/monkey';
import {
  BaseNatsSubscriber,
  BoundedPublisherService,
} from '@ocean.chat/nats-jetstream-provisioner';
import { ImOrchestrateEvent, ImRouteEvent } from '@ocean.chat/types';
import { instanceToPlain } from 'class-transformer';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable({ scope: Scope.DEFAULT })
export class NatsImRouteSubscriber extends BaseNatsSubscriber<ImRouteEvent> {
  protected readonly streamName = 'IM_HANDOFF';
  protected readonly durableName = 'oceanchat-message-im-route';
  protected readonly eventClass = ImRouteEvent;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('message.nats-im-route')
    protected readonly logger: PinoLogger,
    private readonly boundedPublisher: BoundedPublisherService,
    private readonly idGeneratorService: IdGeneratorService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'im.route.>',
    };
  }

  protected async onEvent(event: ImRouteEvent, msg: JsMsg): Promise<void> {
    try {
      const { msgUp } = event;

      // In the future, RPC calls to user/group service for permissions can be added here
      // For now, we proceed to allocate SyncSeqId

      const sequenceKey = msgUp.groupId.startsWith('G')
        ? `group:${msgUp.groupId}`
        : `p2p:${msgUp.groupId}`; // For P2P, we expect a deterministic p2p session id in groupId field

      const syncSeqId =
        await this.idGeneratorService.generateSyncSeqId(sequenceKey);

      const orchestrateEnvelope: ImOrchestrateEvent = {
        userId: event.userId,
        deviceId: event.deviceId,
        gatewayId: event.gatewayId,
        connectionId: event.connectionId,
        rawHeader: {
          cmd: event.rawHeader.cmd,
          reqId: event.rawHeader.reqId,
        },
        msgUp: {
          clientMsgId: msgUp.clientMsgId,
          groupId: msgUp.groupId,
          msgType: msgUp.msgType,
          content: msgUp.content,
          url: msgUp.url,
          width: msgUp.width,
          height: msgUp.height,
          size: msgUp.size,
          format: msgUp.format,
          duration: msgUp.duration,
          fileName: msgUp.fileName,
          extension: msgUp.extension,
          thumbnailUrl: msgUp.thumbnailUrl,
        },
        syncSeqId,
      };

      // Write Fence: Publish to im.orchestrate.msg
      await this.boundedPublisher.publishSafe(
        'im.orchestrate.msg',
        instanceToPlain(orchestrateEnvelope) as Record<string, unknown>,
        'im_orchestrate_forwarding',
        { isCritical: true }, // The write fence is the most critical operation
      );

      // Successfully crossed the write fence, now we can safely ACK the client
      const ackPayloadBase64 = Buffer.from(
        MsgUpAck.encode({
          clientMsgId: msgUp.clientMsgId,
          syncSeqId: syncSeqId,
          success: true,
          errorMessage: '',
        }).finish(),
      ).toString('base64');

      const downboundEvent = {
        userId: event.userId,
        deviceId: event.deviceId,
        cmd: MonkeyCmd.MSG_UP_ACK,
        reqId: event.rawHeader.reqId,
        payload: ackPayloadBase64,
      };

      // Publish the MSG_UP_ACK to the gateway's specific downbound subject
      await this.boundedPublisher.publishSafe(
        `im.down.node.${event.gatewayId}`,
        downboundEvent,
        'im_downbound_ack',
        { isCritical: false }, // ACK is important but not data-critical
      );

      this.logger.debug(
        { userId: event.userId, clientMsgId: msgUp.clientMsgId, syncSeqId },
        'Successfully allocated SyncSeqId, published to WAL, and sent ACK to gateway',
      );
    } catch (error) {
      this.logger.error(
        { err: error, clientMsgId: event.msgUp.clientMsgId },
        'Failed to process IM_ROUTE event',
      );
      throw error;
    }
  }
}
