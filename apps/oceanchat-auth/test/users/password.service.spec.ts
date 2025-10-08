import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { PasswordService } from '../../src/users/password.service';

// Mock the argon2 library
jest.mock('argon2');

describe('Test PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    // Clear mock history before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hash', () => {
    it('should hash a password using argon2', async () => {
      const plainPassword = 'my-secret-password';
      const hashedPassword = 'hashed-password-from-argon2';

      // Configure the mock to return a specific value
      (argon2.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hash(plainPassword);

      expect(argon2.hash).toHaveBeenCalledWith(plainPassword);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('verify', () => {
    it('should verify a password using argon2', async () => {
      const hash = 'stored-hash';
      const plain = 'user-provided-password';

      // Configure the mock to return true
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.verify(hash, plain);

      expect(argon2.verify).toHaveBeenCalledWith(hash, plain);
      expect(result).toBe(true);
    });
  });
});
