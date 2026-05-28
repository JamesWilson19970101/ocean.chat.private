import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { ImDownboundEventDto, SERVICE_INSTANCE_ID } from '@ocean.chat/types';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatWsGateway } from './oceanchat-ws-gateway.gateway';

/**
 * Listens to node-specific downbound events for real-time delivery.
 * Subject: im.down.node.{gatewayId}
 */
@Injectable()
export class NatsDownboundSubscriber extends BaseNatsSubscriber<ImDownboundEventDto> {
  protected readonly streamName = 'IM_DOWNBOUND';
  protected readonly eventClass = ImDownboundEventDto;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger(NatsDownboundSubscriber.name)
    protected readonly logger: PinoLogger,
    @Inject(SERVICE_INSTANCE_ID) private readonly gatewayId: string,
    private readonly gateway: OceanchatWsGateway,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: `im.down.node.${this.gatewayId}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onEvent(event: ImDownboundEventDto, _msg: JsMsg): Promise<void> {
    const { userId, deviceId, cmd, payload, reqId } = event;

    // Direct delivery or micro-batching via Gateway
    this.gateway.dispatchDownbound(userId, deviceId, cmd, payload, reqId);
    return Promise.resolve();
  }
}
