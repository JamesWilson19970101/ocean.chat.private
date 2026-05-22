import { Injectable } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import { BoundedPublisherService } from '@ocean.chat/nats-jetstream-provisioner';
import {
  PresenceHeartbeatEventDto,
  PresenceOfflineEventDto,
} from '@ocean.chat/types';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class OceanchatWsGatewayService {
  constructor(
    private readonly boundedPublisher: BoundedPublisherService,
    @InjectPinoLogger(OceanchatWsGatewayService.name)
    private readonly logger: PinoLogger,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Reports that a user has disconnected from the gateway.
   *
   * This method asynchronously updates the global presence status in Redis via the presence service.
   * It operates as a "fire-and-forget" mechanism, relying on `BoundedPublisherService` for safe, non-blocking delivery.
   *
   * @param userId - The unique identifier of the user who has disconnected.
   * @param deviceId - The specific device identifier (e.g., mobile, desktop) that disconnected.
   * @param gatewayId - The unique identifier of the current WebSocket gateway instance reporting the event.
   */
  reportOffline(userId: string, deviceId: string, gatewayId: string): void {
    const subject = 'presence.conn.offline';
    const context = 'ws_gateway_disconnect';

    this.logger.info(
      { userId, deviceId, gatewayId },
      this.i18nService.translate('REPORTING_USER_OFFLINE_LOG', {
        defaultValue: 'Reporting user offline: {{userId}}',
        userId,
      }),
    );

    const offlineEvent = plainToInstance(PresenceOfflineEventDto, {
      userId,
      deviceId,
      gatewayId,
      timestamp: new Date().toISOString(),
    });

    // Fire-and-forget: publish the event to SYS_PRESENCE stream.
    // The BoundedPublisherService handles backpressure and persistence.
    void this.boundedPublisher
      .publishSafe(subject, offlineEvent, context, { isCritical: false })
      .catch((err) => {
        this.logger.error(
          { userId, deviceId, err },
          this.i18nService.translate('FAILED_TO_PUBLISH_OFFLINE_EVENT_LOG', {
            defaultValue: 'Failed to publish offline event to {{subject}}',
            subject,
          }),
        );
      });
  }

  reportHeartbeat(userId: string, deviceId: string, gatewayId: string): void {
    const heartbeatEvent = plainToInstance(PresenceHeartbeatEventDto, {
      userId,
      deviceId,
      gatewayId,
    });

    // Heartbeat is a volatile signal. Fire and forget without handling catches.
    void this.boundedPublisher
      .publishSafe(
        'presence.conn.heartbeat',
        heartbeatEvent,
        'ws_gateway_heartbeat',
        { isCritical: false },
      )
      .catch(() => {});
  }
}
