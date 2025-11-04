import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { BaseException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';

import { IS_PUBLIC_KEY } from '../decorators/skip-auth.decorator';
import { JwtPayload } from './jwt.strategy';
/**
 * JWT authentication guard for HTTP contexts in the API Gateway.
 * It extends the base Passport AuthGuard for the 'jwt' strategy.
 * This guard will be applied globally, and routes marked with @SkipAuth() will bypass it.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly i18nService: I18nService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route is marked with @SkipAuth()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // If public, skip authentication
    }

    return super.canActivate(context); // Otherwise, proceed with JWT authentication
  }

  /**
   * Overrides the default handleRequest to provide custom error handling and logging.
   * This method is called after the JwtStrategy's `validate` method completes.
   * @param err - An error object if passport-jwt encounters an issue (e.g., malformed token).
   * @param user - The value returned from `JwtStrategy.validate()`. This will be `false` if our custom validation fails.
   * @param info - Additional information, such as `TokenExpiredError` or `JsonWebTokenError`.
   * @returns The user payload if authentication is successful.
   * @throws {UnauthorizedException} If authentication fails for any reason.
   */
  handleRequest<TUser = Pick<JwtPayload, 'username' | 'sub'>>(
    err: any,
    user: TUser,
  ): TUser {
    // If passport-jwt throws an error (e.g., TokenExpiredError), it will be in `err`.
    // If JwtStrategy.validate returns null/false, `user` will be falsy.
    // In either case, authentication has failed.
    if (err || !user) {
      // wrap the original error message or provide a generic one in our custom exception.
      const message = this.i18nService.translate('UNAUTHORIZED');
      throw new BaseException(
        message,
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        { cause: err },
      );
    }
    return user;
  }
}
