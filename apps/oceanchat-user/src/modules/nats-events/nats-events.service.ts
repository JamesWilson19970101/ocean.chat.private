import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { UserLoggedInEvent } from '@ocean.chat/types';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatUserService } from '../../oceanchat-user.service';

@Injectable()
export class NatsEventsService extends BaseNatsSubscriber<UserLoggedInEvent> {
  protected readonly streamName = 'AUTH_EVENTS';
  protected readonly durableName = 'oceanchat-user-auth-events';
  protected readonly eventClass = UserLoggedInEvent;

  constructor(
    protected readonly configService: ConfigService,
    private readonly oceanchatUserService: OceanchatUserService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('user.nats-events')
    protected readonly logger: PinoLogger,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'auth.event.user.loggedIn',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async onEvent(event: UserLoggedInEvent, msg: JsMsg): Promise<void> {
    const idempotencyKey = `idempotency:auth.event.user.loggedIn:${event.userId}:${event.deviceId}:${new Date(event.loginTime).getTime()}`;
    const isFirstTime = await this.redisService.setnx(idempotencyKey, '1', 120);

    if (isFirstTime !== 'OK') {
      this.logger.warn(
        { idempotencyKey },
        this.i18nService.translate('DETECTED_DUPLICATED_NATS_DELIVERY'),
      );
      return; // Return directly so BaseNatsSubscriber will ACK it
    }

    try {
      const loginDate = new Date(event.loginTime);

      // Business Logic: Atomic update
      await this.oceanchatUserService.addDevice(
        event.userId,
        event.deviceId,
        loginDate,
      );

      this.logger.debug(
        { userId: event.userId, deviceId: event.deviceId },
        this.i18nService.translate('SUCCESSFULLY_PROCESSED_LOGGEDIN_EVENT'),
      );
    } catch (error) {
      await this.redisService.del(idempotencyKey);
      throw error;
    }
  }
}
