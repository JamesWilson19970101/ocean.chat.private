import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly i18nService: I18nService,
    @InjectPinoLogger('circuit.breaker.service')
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Execute a promise within a circuit breaker.
   * @param name The name of the circuit breaker (usually the service action name, e.g., 'auth.login')
   * @param action The async function to execute
   * @param options Opossum options
   */
  async fire<T>(
    name: string,
    action: () => Promise<T>,
    options?: CircuitBreaker.Options,
  ): Promise<T> {
    if (!this.breakers.has(name)) {
      // Create a new breaker for this action
      const breaker = new CircuitBreaker(async (fn: () => Promise<T>) => fn(), {
        timeout: 5000, // Default timeout matches typical RPC timeout
        errorThresholdPercentage: 50, // Open if 50% of requests fail
        resetTimeout: 10000, // Wait 10s before trying again (Half-Open)
        ...options,
      });

      breaker.on('open', () =>
        this.logger.warn(
          this.i18nService.translate('CircuitBreaker_Open', { name }),
        ),
      );
      breaker.on('halfOpen', () =>
        this.logger.info(
          this.i18nService.translate('CircuitBreaker_HalfOpen', { name }),
        ),
      );
      breaker.on('close', () =>
        this.logger.info(
          this.i18nService.translate('CircuitBreaker_Close', { name }),
        ),
      );

      this.breakers.set(name, breaker);
    }

    const breaker = this.breakers.get(name)!; // I just ensured it exists
    try {
      return (await breaker.fire(action)) as T;
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((err as any).code === 'EOPENBREAKER') {
        throw new BaseException(
          this.i18nService.translate('Service_Unavailable'),
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCodes.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }
  }
}
