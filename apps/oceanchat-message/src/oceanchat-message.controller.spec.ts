import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatMessageController } from './oceanchat-message.controller';
import { OceanchatMessageService } from './oceanchat-message.service';

describe('OceanchatMessageController', () => {
  let oceanchatMessageController: OceanchatMessageController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatMessageController],
      providers: [OceanchatMessageService],
    }).compile();

    oceanchatMessageController = app.get<OceanchatMessageController>(
      OceanchatMessageController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatMessageController.getHello()).toBe('Hello World!');
    });
  });
});
