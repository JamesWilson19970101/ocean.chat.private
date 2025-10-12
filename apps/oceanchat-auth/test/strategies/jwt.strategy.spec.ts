import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JwtStrategy } from '../../src/strategies/jwt.strategy';

describe('Test JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'secret';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate JWT', () => {
    it('should return user data from payload', () => {
      const payload = { username: 'testuser', sub: 'testuser' };
      const result = strategy.validate(payload);
      expect(result).toEqual({ username: 'testuser', sub: 'testuser' });
    });
  });
});
