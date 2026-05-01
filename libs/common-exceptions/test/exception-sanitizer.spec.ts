/* eslint-disable */
import { AllExceptionsFilter } from '../src/filters/all-exceptions.filter';
import { DomainException } from '../src/exceptions/domain.exception';
import { InfrastructureException } from '../src/exceptions/infrastructure.exception';
import { ErrorCodes } from '../src/constants/error-codes.enum';
import { HttpStatus } from '@nestjs/common';

/**
 * @file Exception Sanitizer logic test
 * 
 * Focus: Security & Error Transparency.
 * This test suite verifies that the AllExceptionsFilter correctly sanitizes
 * infrastructure errors (hiding stack traces/internal details) while 
 * preserving business-meaningful messages for domain exceptions.
 * 
 * Strategy: Zero-DI. Direct instantiation of the Filter.
 */
describe('Exception Sanitizer (Zero-DI Unit Test)', () => {
  let filter: AllExceptionsFilter;
  let mockI18n: any;
  let mockLogger: any;

  beforeEach(() => {
    mockI18n = {
      translate: jest.fn().mockImplementation((key, options) => {
        if (key === 'SYSTEM_UNAVAILABLE') return 'Service Unavailable';
        return options?.defaultValue || key;
      }),
    };
    mockLogger = { warn: jest.fn(), error: jest.fn() };

    // Instantiate with mocks
    filter = new AllExceptionsFilter(
      'test-service',
      'test-instance',
      mockLogger as any,
      mockI18n as any,
    );
  });

  /**
   * Scenario: Domain Exceptions (Trusted).
   * Expectation: The original message and business error code must be preserved for the client.
   */
  it('should preserve DomainException message and errorCode for the client', () => {
    const domainErr = new DomainException('User already exists', ErrorCodes.USERNAME_ALREADY_EXISTS, HttpStatus.CONFLICT);
    
    const response = filter.createErrorResponse(domainErr);

    expect(response.message).toBe('User already exists');
    expect(response.errorCode).toBe(ErrorCodes.USERNAME_ALREADY_EXISTS);
    expect(response.statusCode).toBe(HttpStatus.CONFLICT);
  });

  /**
   * Scenario: Infrastructure Exceptions (Untrusted/Internal).
   * Expectation: Sensitive details MUST be replaced with a generic "Service Unavailable" message
   * to prevent leaking system architecture or library versions.
   */
  it('should sanitize InfrastructureException message to a generic "Service Unavailable"', () => {
    const infraErr = new InfrastructureException(
      'Database connection failed: mongodb://root:password@secret-host:27017', 
      ErrorCodes.UNEXPECTED_ERROR
    );
    
    const response = filter.createErrorResponse(infraErr);

    // Assert: Client should NOT see the DB connection string or internal error details
    expect(response.message).toBe('Service Unavailable');
    expect(response.errorCode).toBe(ErrorCodes.SERVICE_ERROR); // Standardized error code for infra failures
    expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  /**
   * Scenario: Native Error objects.
   * Expectation: Any generic JavaScript Error should be treated as an infrastructure failure and sanitized.
   */
  it('should sanitize generic JavaScript Errors', () => {
    const nativeErr = new Error('Unexpected Null Pointer at line 42');
    
    const response = filter.createErrorResponse(nativeErr);

    expect(response.message).toBe('Service Unavailable');
    expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
