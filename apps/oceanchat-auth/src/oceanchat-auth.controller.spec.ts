import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatAuthController } from './oceanchat-auth.controller';
import { OceanchatAuthService } from './oceanchat-auth.service';

describe('OceanchatAuthController', () => {
  let oceanchatAuthController: OceanchatAuthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatAuthController],
      providers: [OceanchatAuthService],
    }).compile();

    oceanchatAuthController = app.get<OceanchatAuthController>(
      OceanchatAuthController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatAuthController.getHello()).toBe('Hello World!');
    });
  });
});
