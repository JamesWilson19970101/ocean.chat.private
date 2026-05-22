import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatPusherRealtimeController } from './oceanchat-pusher-realtime.controller';
import { OceanchatPusherRealtimeService } from './oceanchat-pusher-realtime.service';

describe('OceanchatPusherRealtimeController', () => {
  let oceanchatPusherRealtimeController: OceanchatPusherRealtimeController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatPusherRealtimeController],
      providers: [OceanchatPusherRealtimeService],
    }).compile();

    oceanchatPusherRealtimeController =
      app.get<OceanchatPusherRealtimeController>(
        OceanchatPusherRealtimeController,
      );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatPusherRealtimeController.getHello()).toBe('Hello World!');
    });
  });
});
