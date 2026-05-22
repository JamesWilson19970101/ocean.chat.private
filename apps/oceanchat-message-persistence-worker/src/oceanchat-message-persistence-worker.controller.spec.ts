import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatMessagePersistenceWorkerController } from './oceanchat-message-persistence-worker.controller';
import { OceanchatMessagePersistenceWorkerService } from './oceanchat-message-persistence-worker.service';

describe('OceanchatMessagePersistenceWorkerController', () => {
  let oceanchatMessagePersistenceWorkerController: OceanchatMessagePersistenceWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatMessagePersistenceWorkerController],
      providers: [OceanchatMessagePersistenceWorkerService],
    }).compile();

    oceanchatMessagePersistenceWorkerController =
      app.get<OceanchatMessagePersistenceWorkerController>(
        OceanchatMessagePersistenceWorkerController,
      );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatMessagePersistenceWorkerController.getHello()).toBe(
        'Hello World!',
      );
    });
  });
});
