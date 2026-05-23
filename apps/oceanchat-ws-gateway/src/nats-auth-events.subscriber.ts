import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorCodes,
  InfrastructureException,
  isAppException,
} from '@ocean.chat/common-exceptions';
import { TokenBlacklistService } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { TokenRevokedEvent } from '@ocean.chat/types';
import { DeliverPolicy, JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatWsGateway } from './oceanchat-ws-gateway.gateway';

/**
 * Listens to JWT revocation events from the AUTH_STATE stream.
 * Ensures the gateway's local blacklist is kept in sync.
 */
@Injectable()
export class NatsAuthEventsSubscriber extends BaseNatsSubscriber<TokenRevokedEvent> {
  protected readonly streamName = 'AUTH_STATE';
  protected readonly eventClass = TokenRevokedEvent;

  constructor(
    protected readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger(NatsAuthEventsSubscriber.name)
    protected readonly logger: PinoLogger,
    private readonly gateway: OceanchatWsGateway,
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
    try {
      await this.tokenBlacklistService.add(event.jti, event.exp);
      this.logger.debug(
        { jti: event.jti },
        this.i18nService.translate('TOKEN_JTI_ADDED_TO_BLACKLIST'),
      );

      // Fan-out kick: immediately terminate any active connections using this revoked token
      this.gateway.kickUserByJti(event.jti, event?.reason);
    } catch (error) {
      const errorMessage = this.i18nService.translate(
        'FAILED_TO_PROCESS_TOKEN_REVOCATION',
        { defaultValue: 'Failed to process token revocation event' },
      );

      this.logger.error({ err: error, jti: event.jti }, errorMessage);

      if (isAppException(error)) {
        throw error;
      }

      throw new InfrastructureException(
        errorMessage,
        ErrorCodes.SERVICE_ERROR,
        500,
        false,
        { cause: error, jti: event.jti },
      );
    }
  }
}
