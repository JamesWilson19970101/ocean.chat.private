import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { BaseNatsSubscriber } from '@ocean.chat/nats-jetstream-provisioner';
import { RedisService } from '@ocean.chat/redis';
import { DevicePresence, PresenceOnlineEventDto } from '@ocean.chat/types';
import { DeliverPolicy, JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class NatsPresenceEventsSubscriber extends BaseNatsSubscriber<any> {
  protected readonly streamName = 'SYS_PRESENCE';
  // Durable consumer ensures no events are lost if the presence service restarts
  protected readonly durableName = 'presence-state-updater';
  protected readonly eventClass = Object;

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
    event: PresenceOnlineEventDto,
    msg: JsMsg,
  ): Promise<void> {
    try {
      const { userId, deviceId, gatewayId, deviceType, timestamp } = event;

      if (!userId || !deviceId || !gatewayId) {
        this.logger.warn(
          { event },
          'Received presence event missing critical routing information',
        );
        return;
      }

      const routingKey = `user:routing:${userId}`;
      const subject = msg.subject;
      // Redis 7.4+ TTL Set to 5 minutes
      const TTL_SECONDS = 300;

      if (subject === 'presence.conn.online') {
        const presenceData: DevicePresence = {
          deviceId,
          deviceType: deviceType,
          gatewayId,
          status: 'online',
          connectTime: timestamp,
        };
        // status: 'online',
        await this.redisService.hset(
          routingKey,
          deviceId,
          JSON.stringify(presenceData),
        );

        // Apply Redis 7.4+ HEXPIRE to this specific field
        await this.redisService
          .getClient()
          .call('HEXPIRE', routingKey, TTL_SECONDS, 'FIELDS', 1, deviceId);

        this.logger.info(
          { userId, deviceId, gatewayId },
          'User online routing set.',
        );
      } else if (subject === 'presence.conn.offline') {
        // Race Condition Prevention:
        // Only delete the route if it still points to the gateway that triggered the offline event.
        // This prevents an old node's delayed offline event from wiping out a new node's active session.
        //
        // Using Lua Script to ensure Compare-And-Delete (CAD) is completely atomic.
        // Note: The Lua script for hdelIfEqual MUST be updated to decode JSON and extract 'gatewayId'.
        const deletedCount = await this.redisService.hdelIfEqual(
          routingKey,
          deviceId,
          gatewayId,
        );

        if (deletedCount === 1) {
          this.logger.info(
            { userId, deviceId },
            'User offline routing cleared.',
          );
        } else {
          this.logger.debug(
            {
              userId,
              deviceId,
              eventGw: gatewayId,
            },
            'Ignored stale offline event from previous gateway connection.',
          );
        }
      } else if (subject === 'presence.conn.heartbeat') {
        // Renew the TTL for the specific device field.
        // If the user actually went offline completely, this gracefully fails or renews nothing.
        await this.redisService
          .getClient()
          .call('HEXPIRE', routingKey, TTL_SECONDS, 'FIELDS', 1, deviceId);
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
