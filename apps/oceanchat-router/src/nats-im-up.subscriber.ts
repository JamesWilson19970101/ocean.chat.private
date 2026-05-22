import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { MsgUp } from '@ocean.chat/monkey';
import {
  BaseNatsSubscriber,
  BoundedPublisherService,
} from '@ocean.chat/nats-jetstream-provisioner';
import { ImRouteEvent, ImUpEvent } from '@ocean.chat/types';
import { instanceToPlain } from 'class-transformer';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable({ scope: Scope.DEFAULT })
export class NatsImUpSubscriber extends BaseNatsSubscriber<ImUpEvent> {
  protected readonly streamName = 'IM_CORE';
  protected readonly durableName = 'oceanchat-router-im-up';
  protected readonly eventClass = ImUpEvent;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('router.nats-im-up')
    protected readonly logger: PinoLogger,
    private readonly boundedPublisher: BoundedPublisherService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'im.up.>',
    };
  }

  protected async onEvent(event: ImUpEvent, msg: JsMsg): Promise<void> {
    try {
      if (!event.userId) {
        throw new DomainException(
          this.i18nService.translate('UNAUTHORIZED'),
          ErrorCodes.UNAUTHORIZED,
          401,
          { originalMessage: 'Unauthorized: Missing userId in envelope' },
        );
      }

      // Decode the base64 payload into MsgUp
      const payloadBuffer = Buffer.from(event.payload, 'base64');
      const msgUp = MsgUp.decode(payloadBuffer);

      // Basic validation
      if (!msgUp.groupId && !msgUp.clientMsgId) {
        throw new DomainException(
          this.i18nService.translate('BAD_REQUEST'),
          ErrorCodes.MALFORMED_EVENT,
          400,
          {
            originalMessage: 'Invalid message: Missing groupId or clientMsgId',
          },
        );
      }

      const isGroup = msgUp.groupId.startsWith('G');
      const subject = isGroup ? 'im.route.group' : 'im.route.p2p';

      const routeEnvelope: ImRouteEvent = {
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
      };

      // Publish to IM_HANDOFF stream (im.route.*)
      await this.boundedPublisher.publishSafe(
        subject,
        instanceToPlain(routeEnvelope) as Record<string, unknown>,
        'im_route_forwarding',
        { isCritical: true }, // Route traffic is critical business logic
      );
      this.logger.debug(
        { userId: event.userId, clientMsgId: msgUp.clientMsgId, subject },
        'Successfully routed MSG_UP',
      );
    } catch (error) {
      this.logger.error(
        { err: error, payload: event.payload },
        'Failed to process MSG_UP',
      );
      throw error;
    }
  }
}
