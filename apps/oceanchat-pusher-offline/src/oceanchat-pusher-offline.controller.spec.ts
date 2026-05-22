import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatPusherOfflineController } from './oceanchat-pusher-offline.controller';
import { OceanchatPusherOfflineService } from './oceanchat-pusher-offline.service';

describe('OceanchatPusherOfflineController', () => {
  let oceanchatPusherOfflineController: OceanchatPusherOfflineController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatPusherOfflineController],
      providers: [OceanchatPusherOfflineService],
    }).compile();

    oceanchatPusherOfflineController = app.get<OceanchatPusherOfflineController>(OceanchatPusherOfflineController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatPusherOfflineController.getHello()).toBe('Hello World!');
    });
  });
});
