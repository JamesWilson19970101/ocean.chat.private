import { validate } from 'class-validator';

import { Match } from '../../../src/common/decorators/match.decorator';

describe('Test Match Decorator', () => {
  // Define a test class that uses the @Match decorator
  class TestDto {
    password: string;

    @Match('password', { message: 'Passwords do not match' })
    confirmPassword: string;
  }

  it('should not return any error when passwords match', async () => {
    const dto = new TestDto();
    dto.password = 'password123';
    dto.confirmPassword = 'password123';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should return an error if passwords do not match', async () => {
    const dto = new TestDto();
    dto.password = 'password123';
    dto.confirmPassword = 'password456';

    const errors = await validate(dto);

    expect(errors.length).toBe(1);
    expect(errors[0].property).toBe('confirmPassword');
    expect(errors[0].constraints).toHaveProperty('Match');
    expect(errors[0].constraints?.Match).toBe('Passwords do not match');
  });

  it('should return an error if one value is null or undefined', async () => {
    const dto = new TestDto();
    dto.password = 'password123';
    dto.confirmPassword = undefined as any;

    const errors = await validate(dto);

    expect(errors.length).toBe(1);
    expect(errors[0].property).toBe('confirmPassword');
  });

  it('should handle empty strings correctly', async () => {
    const dto = new TestDto();
    dto.password = '';
    dto.confirmPassword = '';

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });
});
