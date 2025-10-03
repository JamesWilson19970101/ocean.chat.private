import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatApiGatewayController } from './oceanchat-api-gateway.controller';
import { OceanchatApiGatewayService } from './oceanchat-api-gateway.service';

describe('OceanchatApiGatewayController', () => {
  let oceanchatApiGatewayController: OceanchatApiGatewayController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatApiGatewayController],
      providers: [OceanchatApiGatewayService],
    }).compile();

    oceanchatApiGatewayController = app.get<OceanchatApiGatewayController>(OceanchatApiGatewayController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatApiGatewayController.getHello()).toBe('Hello World!');
    });
  });
});
