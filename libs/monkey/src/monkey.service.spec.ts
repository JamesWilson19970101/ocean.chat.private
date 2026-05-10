import { Test, TestingModule } from '@nestjs/testing';
import { MonkeyService } from './monkey.service';

describe('MonkeyService', () => {
  let service: MonkeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonkeyService],
    }).compile();

    service = module.get<MonkeyService>(MonkeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
