import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { IdGeneratorService } from '@ocean.chat/id-generator';
import { MonkeyCmd, MsgUp, MsgUpAck } from '@ocean.chat/monkey';
import {
  BaseNatsSubscriber,
  BoundedPublisherService,
} from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import {
  ImDownboundEventDto,
  ImOrchestrateEvent,
  ImUpEnvelopeDto,
  NatsSubjects,
} from '@ocean.chat/types';
import { plainToInstance } from 'class-transformer';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable({ scope: Scope.DEFAULT })
export class NatsImRouteSubscriber extends BaseNatsSubscriber<ImUpEnvelopeDto> {
  protected readonly streamName = 'IM_HANDOFF';
  protected readonly durableName = 'oceanchat-message-im-route';
  protected readonly eventClass = ImUpEnvelopeDto;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('message.nats-im-route')
    protected readonly logger: PinoLogger,
    private readonly boundedPublisher: BoundedPublisherService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'im.route.>',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async onEvent(event: ImUpEnvelopeDto, msg: JsMsg): Promise<void> {
    try {
      const payloadBuffer = Buffer.from(event.payload, 'base64');

      const msgUp = MsgUp.decode(payloadBuffer);

      // TODO: Use RPC verify sender's identity and muted status
      // In the future, RPC calls to user/group service for permissions can be added here
      // For now, I proceed to allocate SyncSeqId

      const sequenceKey = !msgUp.groupId.startsWith('D')
        ? `group:${msgUp.groupId}`
        : `p2p:${msgUp.groupId}`; // For P2P, we expect a deterministic p2p session id in groupId field

      const syncSeqId =
        await this.idGeneratorService.generateSyncSeqId(sequenceKey);

      const orchestrateEnvelope = plainToInstance(ImOrchestrateEvent, {
        userId: event.userId,
        deviceId: event.deviceId,
        gatewayId: event.gatewayId,
        rawHeader: {
          cmd: event.rawHeader.cmd,
          reqId: event.rawHeader.reqId,
        },
        msgUp: {
          ...msgUp,
        },
        syncSeqId,
      });

      // TODO: Analyze whether it is necessary to extract im.orchestrate.msg into a separate stream,
      // and whether the retention time of the im.orchestrate.msg topic is too short.
      // Write Fence: Publish to im.orchestrate.msg
      await this.boundedPublisher.publishSafe(
        NatsSubjects.IM_ORCHESTRATE_MSG,
        orchestrateEnvelope,
        'im_orchestrate_forwarding',
        { isCritical: true }, // The write fence is the most critical operation
      );

      // Successfully crossed the write fence.
      // I can now concurrently maintain the ZSET sliding window and send the ACK to the client to reduce latency.
      const zsetKey = `group:msg:${msgUp.groupId}`;

      const ackPayloadBase64 = Buffer.from(
        MsgUpAck.encode({
          clientMsgId: msgUp?.clientMsgId ? msgUp.clientMsgId : '',
          syncSeqId: syncSeqId,
          success: true,
          errorMessage: '', // TODO: Use ExceptionACK
          serverTimestamp: Date.now().toString(),
        }).finish(),
      ).toString('base64');

      const downboundEvent = plainToInstance(ImDownboundEventDto, {
        userId: event.userId,
        deviceId: event.deviceId,
        cmd: MonkeyCmd.MSG_UP_ACK,
        reqId: event.rawHeader.reqId,
        payload: ackPayloadBase64,
      });

      // Execute Redis sliding window maintenance and Gateway ACK concurrently
      await Promise.all([
        this.redisService.addMessageToSlidingWindow(zsetKey, syncSeqId, 100),
        this.boundedPublisher.publishSafe(
          `${NatsSubjects.IM_DOWN_NODE_PREFIX}${event.gatewayId}`,
          downboundEvent,
          'im_downbound_ack',
          { isCritical: false }, // ACK is important but not data-critical
        ),
      ]);

      this.logger.debug(
        { userId: event.userId, clientMsgId: msgUp.clientMsgId, syncSeqId },
        'Successfully allocated SyncSeqId, published to WAL, and sent ACK to gateway',
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to process IM_ROUTE event');
      throw error;
    }
  }
}
