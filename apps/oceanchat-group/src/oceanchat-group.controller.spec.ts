import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatGroupController } from './oceanchat-group.controller';
import { OceanchatGroupService } from './oceanchat-group.service';

describe('OceanchatGroupController', () => {
  let oceanchatGroupController: OceanchatGroupController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatGroupController],
      providers: [OceanchatGroupService],
    }).compile();

    oceanchatGroupController = app.get<OceanchatGroupController>(
      OceanchatGroupController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatGroupController.getHello()).toBe('Hello World!');
    });
  });
});
