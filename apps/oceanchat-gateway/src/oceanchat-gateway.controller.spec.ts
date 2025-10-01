import { Test, TestingModule } from '@nestjs/testing';

import { OceanchatGatewayController } from './oceanchat-gateway.controller';
import { OceanchatGatewayService } from './oceanchat-gateway.service';

describe('OceanchatGatewayController', () => {
  let oceanchatGatewayController: OceanchatGatewayController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatGatewayController],
      providers: [OceanchatGatewayService],
    }).compile();

    oceanchatGatewayController = app.get<OceanchatGatewayController>(
      OceanchatGatewayController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatGatewayController.getHello()).toBe('Hello World!');
    });
  });
});
