import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { MsgUp } from '@ocean.chat/monkey';
import {
  BaseNatsSubscriber,
  BoundedPublisherService,
} from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { MsgUpType } from '@ocean.chat/types';
import { ImRouteEvent, ImUpEnvelopeDto, NatsSubjects } from '@ocean.chat/types';
import { instanceToPlain } from 'class-transformer';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable({ scope: Scope.DEFAULT })
export class NatsImUpSubscriber extends BaseNatsSubscriber<ImUpEnvelopeDto> {
  protected readonly streamName = 'IM_CORE';
  protected readonly durableName = 'oceanchat-router-im-up';
  protected readonly eventClass = ImUpEnvelopeDto;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger(NatsImUpSubscriber.name)
    protected readonly logger: PinoLogger,
    private readonly boundedPublisher: BoundedPublisherService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subjects: ['im.up.group', 'im.up.p2p'],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async onEvent(event: ImUpEnvelopeDto, msg: JsMsg): Promise<void> {
    try {
      // Business Rate Limiting: Max 10 requests per second per user
      const rateLimitKey = `rate:biz:user:${event.userId}`;
      const LUA_INCR = `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 then
          redis.call("EXPIRE", KEYS[1], ARGV[1])
        end
        return current
      `;
      const currentCount = (await this.redisService.eval(
        LUA_INCR,
        [rateLimitKey],
        [1],
      )) as number;

      if (currentCount > 10) {
        throw new DomainException(
          this.i18nService.translate('RATE_LIMIT_EXCEEDED'),
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          429,
          {
            originalMessage: this.i18nService.translate(
              'RATE_LIMIT_EXCEEDED_BIZ',
              {
                userId: event.userId,
              },
            ),
          },
        );
      }

      // Decode the base64 payload into MsgUp
      const payloadBuffer = Buffer.from(event.payload, 'base64');
      const msgUp: MsgUpType = MsgUp.decode(
        payloadBuffer,
      ) as unknown as MsgUpType;

      // Basic validation
      if (!msgUp.groupId && !msgUp.clientMsgId) {
        throw new DomainException(
          this.i18nService.translate('BAD_REQUEST'),
          ErrorCodes.MALFORMED_EVENT,
          400,
          {
            originalMessage: this.i18nService.translate(
              'INVALID_MESSAGE_MISSING_ID',
            ),
          },
        );
      }

      const isGroup = !msgUp.groupId.startsWith('D');
      const subject = isGroup
        ? NatsSubjects.IM_ROUTE_GROUP
        : NatsSubjects.IM_ROUTE_P2P;

      const routeEnvelope: ImRouteEvent = {
        userId: event.userId,
        deviceId: event.deviceId,
        gatewayId: event.gatewayId,
        rawHeader: {
          cmd: event.rawHeader.cmd,
          reqId: event.rawHeader.reqId,
        },
        msgUp: { ...msgUp },
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
        this.i18nService.translate('SUCCESSFULLY_ROUTED_MSG_UP'),
      );
    } catch (error) {
      this.logger.error(
        { err: error, payload: event.payload },
        this.i18nService.translate('FAILED_TO_PROCESS_MSG_UP'),
      );
      throw error;
    }
  }
}
