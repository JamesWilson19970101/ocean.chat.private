import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorCodes,
  InfrastructureException,
  isAppException,
} from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { SyncCursorReadEventDto } from '@ocean.chat/types';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatWsGateway } from './oceanchat-ws-gateway.gateway';

/**
 * Listens to cross-device read receipt sync events.
 * Subject: sync.cursor.read.*
 */
@Injectable()
export class NatsSyncSubscriber extends BaseNatsSubscriber<SyncCursorReadEventDto> {
  protected readonly streamName = 'DEVICE_SYNC';
  protected readonly eventClass = SyncCursorReadEventDto;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('gateway.nats-sync')
    protected readonly logger: PinoLogger,
    private readonly gateway: OceanchatWsGateway,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'sync.cursor.read.*',
      // Ephemeral broadcast: Fan-out to all gateway pods
      durable_name: undefined,
    };
  }

  protected async onEvent(
    event: SyncCursorReadEventDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _msg: JsMsg,
  ): Promise<void> {
    try {
      const { userId, groupId, syncSeqId } = event;

      if (!userId) {
        this.logger.warn(
          { event },
          this.i18nService.translate('RECEIVED_SYNC_EVENT_WITHOUT_USERID', {
            defaultValue: 'Received sync event without userId',
          }),
        );
        return Promise.resolve();
      }

      // Dispatch to all active connections of this user on this pod
      this.gateway.dispatchSync(userId, groupId, syncSeqId);
      return Promise.resolve();
    } catch (error) {
      const errorMessage = this.i18nService.translate(
        'FAILED_TO_DISPATCH_SYNC_EVENT',
        { defaultValue: 'Failed to dispatch sync event to gateway' },
      );

      this.logger.error({ err: error, event }, errorMessage);

      if (isAppException(error)) {
        throw error;
      }

      throw new InfrastructureException(
        errorMessage,
        ErrorCodes.SERVICE_ERROR,
        500,
        false,
        { cause: error, event },
      );
    }
  }
}
