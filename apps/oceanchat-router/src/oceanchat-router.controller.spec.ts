import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatRouterController } from './oceanchat-router.controller';
import { OceanchatRouterService } from './oceanchat-router.service';

describe('OceanchatRouterController', () => {
  let oceanchatRouterController: OceanchatRouterController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatRouterController],
      providers: [OceanchatRouterService],
    }).compile();

    oceanchatRouterController = app.get<OceanchatRouterController>(
      OceanchatRouterController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatRouterController.getHello()).toBe('Hello World!');
    });
  });
});
