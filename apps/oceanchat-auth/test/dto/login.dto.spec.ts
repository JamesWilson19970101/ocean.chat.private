// the core of test dto is mock the process of pipe validation

import { validate } from 'class-validator';

import { LoginDto } from '../../src/dto/login.dto';

describe('Test LoginDto', () => {
  it('should pass all validation with valid data', async () => {
    const dto = new LoginDto();
    dto.username = 'testuser';
    dto.password = 'testpassword';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('username validation', () => {
    it('should fail if username is empty', async () => {
      const dto = new LoginDto();
      dto.username = '';
      dto.password = 'password123';

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('username');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail if username is not a string', async () => {
      const dto = new LoginDto();
      dto.username = 123 as any;
      dto.password = 'password123';

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('username');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('password validation', () => {
    it('should fail if password is empty', async () => {
      const dto = new LoginDto();
      dto.username = 'testuser';
      dto.password = '';

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail if password is not a string', async () => {
      const dto = new LoginDto();
      dto.username = 'testuser';
      dto.password = false as any;

      const errors = await validate(dto);

      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });
});
