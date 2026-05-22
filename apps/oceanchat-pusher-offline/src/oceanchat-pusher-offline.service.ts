import { Injectable } from '@nestjs/common';
import { OfflinePushEvent, VendorType } from '@ocean.chat/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class OceanchatPusherOfflineService {
  constructor(
    @InjectPinoLogger(OceanchatPusherOfflineService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Simulates an HTTP/2 call to a third-party push vendor like APNs or FCM.
   * Throws an error to simulate network failures or rate limits.
   */
  async sendPushNotification(event: OfflinePushEvent): Promise<void> {
    this.logger.debug(
      { vendor: event.vendor, userId: event.userId, deviceToken: event.deviceToken },
      `Sending offline push request to ${event.vendor} API`,
    );

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate occasional random failures (e.g., 5% chance of HTTP 503)
    if (Math.random() < 0.05) {
      this.logger.warn(`Simulated HTTP 503 from ${event.vendor}`);
      throw new Error(`External push API error from ${event.vendor}`);
    }

    this.logger.info(
      { vendor: event.vendor, userId: event.userId },
      `Successfully pushed notification via ${event.vendor}`,
    );
  }
}
