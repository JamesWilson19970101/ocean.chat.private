import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatWsGatewayController } from './oceanchat-ws-gateway.controller';
import { OceanchatWsGatewayService } from './oceanchat-ws-gateway.service';

describe('OceanchatWsGatewayController', () => {
  let oceanchatWsGatewayController: OceanchatWsGatewayController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatWsGatewayController],
      providers: [OceanchatWsGatewayService],
    }).compile();

    oceanchatWsGatewayController = app.get<OceanchatWsGatewayController>(OceanchatWsGatewayController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatWsGatewayController.getHello()).toBe('Hello World!');
    });
  });
});
