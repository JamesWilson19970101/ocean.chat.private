import { Test, TestingModule } from '@nestjs/testing';

import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';

describe('StreamController', () => {
  let streamController: StreamController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [StreamController],
      providers: [StreamService],
    }).compile();

    streamController = app.get<StreamController>(StreamController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(streamController.getHello()).toBe('Hello World!');
    });
  });
});
