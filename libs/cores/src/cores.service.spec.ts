import { Test, TestingModule } from '@nestjs/testing';

import { CoresService } from './cores.service';

describe('CoresService', () => {
  let service: CoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoresService],
    }).compile();

    service = module.get<CoresService>(CoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
