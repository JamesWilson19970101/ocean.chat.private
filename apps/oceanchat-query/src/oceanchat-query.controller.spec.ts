import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatQueryController } from './oceanchat-query.controller';
import { OceanchatQueryService } from './oceanchat-query.service';

describe('OceanchatQueryController', () => {
  let oceanchatQueryController: OceanchatQueryController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatQueryController],
      providers: [OceanchatQueryService],
    }).compile();

    oceanchatQueryController = app.get<OceanchatQueryController>(OceanchatQueryController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatQueryController.getHello()).toBe('Hello World!');
    });
  });
});
