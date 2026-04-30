import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { TokenRevokedEvent } from '@ocean.chat/types';
import { DeliverPolicy, JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TokenBlacklistService } from '../../common/services/token-blacklist.service';

@Injectable()
export class NatsEventsService extends BaseNatsSubscriber<TokenRevokedEvent> {
  protected readonly streamName = 'AUTH_STATE';
  protected readonly eventClass = TokenRevokedEvent;

  constructor(
    protected readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('gateway.nats-events')
    protected readonly logger: PinoLogger,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'auth.jwt.revoke',
      deliver_policy: DeliverPolicy.All,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async onEvent(event: TokenRevokedEvent, msg: JsMsg): Promise<void> {
    const idempotencyKey = `idempotency:auth.jwt.revoke:${event.jti}`;
    const isFirstTime = await this.redisService.setnx(idempotencyKey, '1', 120);

    if (isFirstTime !== 'OK') {
      this.logger.warn(
        { idempotencyKey },
        this.i18nService.translate('DETECTED_DUPLICATED_NATS_DELIVERY'),
      );
      return; // Return directly so BaseNatsSubscriber will ACK it
    }

    try {
      await this.tokenBlacklistService.add(event.jti, event.exp);
      this.logger.debug(
        { jti: event.jti },
        this.i18nService.translate('TOKEN_JTI_ADDED_TO_BLACKLIST'),
      );
    } catch (error) {
      await this.redisService.del(idempotencyKey);
      throw error;
    }
  }
}
