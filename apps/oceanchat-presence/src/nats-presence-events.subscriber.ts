import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import {
  DevicePresence,
  PresenceHeartbeatEventDto,
  PresenceOfflineEventDto,
  PresenceOnlineEventDto,
} from '@ocean.chat/types';
import { DeliverPolicy, JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class NatsPresenceEventsSubscriber extends BaseNatsSubscriber<
  PresenceOnlineEventDto | PresenceOfflineEventDto | PresenceHeartbeatEventDto
> {
  protected readonly streamName = 'SYS_PRESENCE';
  // Durable consumer ensures no events are lost if the presence service restarts
  protected readonly durableName = 'presence-state-updater';
  protected readonly eventClass = {
    'presence.conn.online': PresenceOnlineEventDto,
    'presence.conn.offline': PresenceOfflineEventDto,
    'presence.conn.heartbeat': PresenceHeartbeatEventDto,
  };

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    private readonly redisService: RedisService,
    @InjectPinoLogger(NatsPresenceEventsSubscriber.name)
    protected readonly logger: PinoLogger,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: 'presence.conn.*',
      deliver_policy: DeliverPolicy.All,
    };
  }

  protected async onEvent(
    event:
      | PresenceOnlineEventDto
      | PresenceOfflineEventDto
      | PresenceHeartbeatEventDto,
    msg: JsMsg,
  ): Promise<void> {
    try {
      const subject = msg.subject;
      // Redis 7.4+ TTL Set to 5 minutes
      const TTL_SECONDS = 300;

      if (subject === 'presence.conn.online') {
        const onlineEvent = event as PresenceOnlineEventDto;
        if (
          !onlineEvent.userId ||
          !onlineEvent.deviceId ||
          !onlineEvent.gatewayId
        ) {
          this.logger.warn(
            { event },
            'Received presence event missing critical routing information',
          );
          return;
        }
        const routingKey = `user:routing:${onlineEvent.userId}`;

        const presenceData: DevicePresence = {
          deviceId: onlineEvent.deviceId,
          deviceType: onlineEvent.deviceType,
          gatewayId: onlineEvent.gatewayId,
          status: 'online',
          connectTime: onlineEvent.timestamp,
        };
        // status: 'online',
        await this.redisService.hset(
          routingKey,
          onlineEvent.deviceId,
          JSON.stringify(presenceData),
        );

        // Apply Redis 7.4+ HEXPIRE to this specific field
        await this.redisService
          .getClient()
          .call(
            'HEXPIRE',
            routingKey,
            TTL_SECONDS,
            'FIELDS',
            1,
            onlineEvent.deviceId,
          );

        this.logger.info(
          {
            userId: onlineEvent.userId,
            deviceId: onlineEvent.deviceId,
            gatewayId: onlineEvent.gatewayId,
          },
          'User online routing set.',
        );
      } else if (subject === 'presence.conn.offline') {
        const offlineEvent = event as PresenceOfflineEventDto;
        if (
          !offlineEvent.userId ||
          !offlineEvent.deviceId ||
          !offlineEvent.gatewayId
        ) {
          this.logger.warn(
            { event },
            'Received presence event missing critical routing information',
          );
          return;
        }
        const routingKey = `user:routing:${offlineEvent.userId}`;

        // Race Condition Prevention:
        // Only delete the route if it still points to the gateway that triggered the offline event.
        // This prevents an old node's delayed offline event from wiping out a new node's active session.
        //
        // Using Lua Script to ensure Compare-And-Delete (CAD) is completely atomic and decode JSON.
        const deletedCount = await this.redisService.hdelIfJsonPropertyEquals(
          routingKey,
          offlineEvent.deviceId,
          'gatewayId',
          offlineEvent.gatewayId,
        );

        if (deletedCount === 1) {
          this.logger.info(
            { userId: offlineEvent.userId, deviceId: offlineEvent.deviceId },
            'User offline routing cleared.',
          );
        } else {
          this.logger.debug(
            {
              userId: offlineEvent.userId,
              deviceId: offlineEvent.deviceId,
              eventGw: offlineEvent.gatewayId,
            },
            'Ignored stale offline event from previous gateway connection.',
          );
        }
      } else if (subject === 'presence.conn.heartbeat') {
        const heartbeatEvent = event as PresenceHeartbeatEventDto;
        if (!heartbeatEvent.userId || !heartbeatEvent.deviceId) {
          this.logger.warn(
            { event },
            'Received presence event missing critical routing information',
          );
          return;
        }
        const routingKey = `user:routing:${heartbeatEvent.userId}`;

        // Renew the TTL for the specific device field.
        // If the user actually went offline completely, this gracefully fails or renews nothing.
        await this.redisService
          .getClient()
          .call(
            'HEXPIRE',
            routingKey,
            TTL_SECONDS,
            'FIELDS',
            1,
            heartbeatEvent.deviceId,
          );
      }
    } catch (error) {
      this.logger.error(
        { err: error, event },
        'Failed to process presence event',
      );
      throw error; // Let JetStream retry the message based on its redelivery policy
    }
  }
}
