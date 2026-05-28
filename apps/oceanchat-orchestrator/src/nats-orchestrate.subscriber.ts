import { Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { MonkeyCmd, MsgNotify } from '@ocean.chat/monkey';
import {
  BaseNatsSubscriber,
  BoundedPublisherService,
} from '@ocean.chat/nats-jetstream-provisioner';
import {
  ImOrchestrateEvent,
  NatsSubjects,
  OfflinePushEvent,
} from '@ocean.chat/types';
import { instanceToPlain } from 'class-transformer';
import { JsMsg } from 'nats';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OceanchatOrchestratorService } from './oceanchat-orchestrator.service';

@Injectable({ scope: Scope.DEFAULT })
export class NatsOrchestrateSubscriber extends BaseNatsSubscriber<ImOrchestrateEvent> {
  protected readonly streamName = 'IM_HANDOFF';
  protected readonly durableName = 'oceanchat-orchestrator-group';
  protected readonly eventClass = ImOrchestrateEvent;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly i18nService: I18nService,
    @InjectPinoLogger('orchestrator.nats')
    protected readonly logger: PinoLogger,
    private readonly orchestratorService: OceanchatOrchestratorService,
    private readonly boundedPublisher: BoundedPublisherService,
  ) {
    super();
  }

  protected getConsumerConfig() {
    return {
      filter_subject: NatsSubjects.IM_ORCHESTRATE_MSG,
    };
  }

  protected async onEvent(
    event: ImOrchestrateEvent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    msg: JsMsg,
  ): Promise<void> {
    try {
      const { msgUp, userId: senderId, syncSeqId } = event;
      const groupId = msgUp.groupId;

      // 1. Fetch recipients
      const recipients = await this.orchestratorService.getRecipients(
        groupId,
        senderId,
      );

      // We exclude the sender from receiving their own message via offline push or online notify
      // Their local app already has the message and they received the MSG_UP_ACK.
      // (Note: Syncing to sender's other devices is handled by DEVICE_SYNC stream).
      const targetUserIds = recipients.filter((id) => id !== senderId);

      if (targetUserIds.length === 0) {
        this.logger.debug({ groupId }, 'No targets to dispatch message to.');
        return;
      }

      // 2. Evaluate presence status
      const presenceMap =
        await this.orchestratorService.evaluatePresenceBatch(targetUserIds);

      // 3. Group targets
      // onlineNodes: Map<gatewayId, Array<{ userId, deviceId }>>
      const onlineNodes = new Map<
        string,
        { userId: string; deviceId: string }[]
      >();
      // offlineUsers: Array<userId>
      const offlineUsers: string[] = [];

      for (const [userId, status] of presenceMap.entries()) {
        if (status.isOnline && status.devices.length > 0) {
          for (const device of status.devices) {
            if (!onlineNodes.has(device.gatewayId)) {
              onlineNodes.set(device.gatewayId, []);
            }
            onlineNodes
              .get(device.gatewayId)!
              .push({ userId, deviceId: device.deviceId });
          }
        } else {
          offlineUsers.push(userId);
        }
      }

      this.logger.info(
        {
          groupId,
          syncSeqId,
          onlineGateways: onlineNodes.size,
          offlineCount: offlineUsers.length,
        },
        'Message dispatch evaluation completed.',
      );

      if (onlineNodes.size > 0) {
        const notifyPayloadBase64 = Buffer.from(
          MsgNotify.encode({
            groupId,
            syncSeqId,
          }).finish(),
        ).toString('base64');

        const tasks: (() => Promise<void>)[] = [];

        for (const [gatewayId, devices] of onlineNodes.entries()) {
          for (const { userId, deviceId } of devices) {
            const downboundEvent = {
              userId,
              deviceId,
              cmd: MonkeyCmd.MSG_NOTIFY,
              reqId: 0,
              payload: notifyPayloadBase64,
            };

            // TODO: later publish message by pusher-realtime service
            tasks.push(() =>
              this.boundedPublisher.publishSafe(
                `${NatsSubjects.IM_DOWN_NODE_PREFIX}${gatewayId}`,
                downboundEvent,
                'im_downbound_notify',
                { isCritical: false }, // MSG_NOTIFY is a volatile signal, can be dropped under extreme load (Push-Pull Hybrid handles recovery)
              ),
            );
          }
        }

        // Process in chunks of 500 to prevent memory exhaustion and NATS buffer overflow
        const chunkSize = 500;
        for (let i = 0; i < tasks.length; i += chunkSize) {
          const chunk = tasks.slice(i, i + chunkSize);
          await Promise.allSettled(chunk.map((task) => task()));
        }
      }

      // Slice 3: Dispatch offline push tasks
      if (offlineUsers.length > 0) {
        const offlineDevicesMap =
          this.orchestratorService.getOfflineDevices(offlineUsers);
        const tasks: (() => Promise<void>)[] = [];

        for (const [userId, devices] of offlineDevicesMap.entries()) {
          // Calculate the accurate badge count using ZSET
          const badgeCount = await this.orchestratorService.calculateBadge(
            userId,
            groupId,
          );

          for (const device of devices) {
            const pushEvent: OfflinePushEvent = {
              userId,
              groupId,
              vendor: device.vendor,
              deviceToken: device.deviceToken,
              syncSeqId,
              collapseKey: groupId, // Collapse by groupId to prevent storm
              badge: badgeCount, // Exact badge count retrieved in O(log(N))
            };

            const pushSubject = `${NatsSubjects.PUSH_OFFLINE_PREFIX}${device.vendor}.${userId}`;

            tasks.push(() =>
              this.boundedPublisher.publishSafe(
                pushSubject,
                instanceToPlain(pushEvent) as Record<string, unknown>,
                'im_offline_push',
                { isCritical: false }, // APNs/FCM dropping is acceptable, client will sync
              ),
            );
          }
        }

        // Process in chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < tasks.length; i += chunkSize) {
          const chunk = tasks.slice(i, i + chunkSize);
          await Promise.allSettled(chunk.map((task) => task()));
        }
      }
    } catch (error) {
      this.logger.error(
        { err: error, event },
        'Failed to orchestrate message dispatch',
      );
      throw error;
    }
  }
}
