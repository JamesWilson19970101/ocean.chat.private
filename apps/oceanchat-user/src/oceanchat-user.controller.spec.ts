import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatUserController } from './oceanchat-user.controller';
import { OceanchatUserService } from './oceanchat-user.service';

describe('OceanchatUserController', () => {
  let oceanchatUserController: OceanchatUserController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatUserController],
      providers: [OceanchatUserService],
    }).compile();

    oceanchatUserController = app.get<OceanchatUserController>(
      OceanchatUserController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatUserController.getHello()).toBe('Hello World!');
    });
  });
});
