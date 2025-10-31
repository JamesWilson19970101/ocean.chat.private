import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateUserDto } from '../../../src/users/dto/create-user.dto';

describe('Test CreateUserDto', () => {
  const createDto = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => {
    const baseDto = {
      username: 'testuser',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    const merged = { ...baseDto, ...overrides };
    return plainToInstance(CreateUserDto, merged);
  };

  it('should pass validation with valid data', async () => {
    const dto = createDto();
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  describe('username', () => {
    it('should fail if username is not a string', async () => {
      const dto = createDto({ username: 123 as any });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail if username is empty', async () => {
      const dto = createDto({ username: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail if username is null or undefined', async () => {
      const dto = createDto({ username: undefined });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // isNotEmpty and isString will both fail
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('password', () => {
    it('should fail if password is not a string', async () => {
      const dto = createDto({ password: 123 as any });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // The 'match' constraint on confirmPassword will also fail, so I need to find the specific error for 'password'
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError!.constraints).toHaveProperty('isString');
    });

    it('should fail if password is empty', async () => {
      const dto = createDto({ password: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // Find the specific error for 'password'
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError!.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail if password is null or undefined', async () => {
      const dto = createDto({ password: undefined });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // Find the specific error for 'password'
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError!.constraints).toHaveProperty('isNotEmpty');
      expect(passwordError!.constraints).toHaveProperty('isString');
    });
  });

  describe('confirmPassword', () => {
    it('should fail if confirmPassword is not a string', async () => {
      const dto = createDto({ confirmPassword: 123 as any });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const confirmPasswordError = errors.find(
        (e) => e.property === 'confirmPassword',
      );
      expect(confirmPasswordError).toBeDefined();
      expect(confirmPasswordError!.constraints).toHaveProperty('isString');
    });

    it('should fail if confirmPassword is empty', async () => {
      const dto = createDto({ confirmPassword: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const confirmPasswordError = errors.find(
        (e) => e.property === 'confirmPassword',
      );
      expect(confirmPasswordError).toBeDefined();
      expect(confirmPasswordError!.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail if confirmPassword is null or undefined', async () => {
      const dto = createDto({ confirmPassword: undefined });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const confirmPasswordError = errors.find(
        (e) => e.property === 'confirmPassword',
      );
      expect(confirmPasswordError).toBeDefined();
      expect(confirmPasswordError!.constraints).toHaveProperty('isNotEmpty');
      expect(confirmPasswordError!.constraints).toHaveProperty('isString');
    });

    it('should fail if confirmPassword does not match password', async () => {
      const dto = createDto({ confirmPassword: 'differentPassword' });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('confirmPassword');
      expect(errors[0].constraints).toBeDefined();
      expect(errors[0].constraints).toHaveProperty('Match');
      expect(errors[0].constraints!.Match).toBe('Passwords do not match');
    });
  });
});
