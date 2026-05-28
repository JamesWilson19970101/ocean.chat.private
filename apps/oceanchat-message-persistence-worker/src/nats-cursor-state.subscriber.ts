import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { SyncCursorReadEventDto } from '@ocean.chat/types';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatMessagePersistenceWorkerService } from './oceanchat-message-persistence-worker.service';

/**
 * Cursor Persistence Subscriber using BaseNatsSubscriber.
 * Reliable Pull-based ingestion for read cursors with dual-write persistence.
 */
@Injectable({ scope: Scope.DEFAULT })
export class NatsCursorStateSubscriber extends BaseNatsSubscriber<SyncCursorReadEventDto> {
  protected readonly streamName = 'CURSOR_STATE';
  protected readonly durableName = 'cursor-persistence-worker-group';
  protected readonly eventClass = SyncCursorReadEventDto;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('worker.persistence.cursor')
    protected readonly logger: PinoLogger,
    private readonly persistenceService: OceanchatMessagePersistenceWorkerService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      // Wildcard to capture read cursor states for all groups and users
      filter_subject: 'cursor.read.>',
    };
  }

  /**
   * Forwards the cursor event to the service's async buffer.
   * Base class will only ACK this JsMsg once the dual-write (Redis + Mongo) is confirmed.
   */
  protected async onEvent(
    event: SyncCursorReadEventDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _msg: JsMsg,
  ): Promise<void> {
    await this.persistenceService.bufferCursorForPersistence(event);
  }
}
