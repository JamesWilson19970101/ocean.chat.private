import { Test, TestingModule } from '@nestjs/testing';
import { OceanchatOrchestratorController } from './oceanchat-orchestrator.controller';
import { OceanchatOrchestratorService } from './oceanchat-orchestrator.service';

describe('OceanchatOrchestratorController', () => {
  let oceanchatOrchestratorController: OceanchatOrchestratorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OceanchatOrchestratorController],
      providers: [OceanchatOrchestratorService],
    }).compile();

    oceanchatOrchestratorController = app.get<OceanchatOrchestratorController>(OceanchatOrchestratorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(oceanchatOrchestratorController.getHello()).toBe('Hello World!');
    });
  });
});
