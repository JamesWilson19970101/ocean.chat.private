import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthenticatedUser } from '@ocean.chat/types';
/**
 * A custom JWT authentication guard for RPC contexts.
 * It extends the base Passport AuthGuard for the 'jwt' strategy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly i18nService: I18nService) {
    super();
  }
  /**
   * Overrides the default getRequest method to extract data from an RPC context.
   * The JwtStrategy is configured to extract the token from this data object.
   * @param context The execution context.
   * @returns The data payload from the RPC call.
   */
  getRequest(context: ExecutionContext): Record<string, unknown> {
    return context.switchToRpc().getData();
  }

  /**
   * Overrides the default handleRequest to manage the result of the authentication attempt.
   * In an RPC context, I want to return the user object directly upon success.
   * @param err - An error object if authentication fails.
   * @param user - The user object returned from the JwtStrategy's `validate` method.
   * @returns The authenticated user object.
   * @throws The error if authentication fails or the user is not found.
   */
  handleRequest<TUser = AuthenticatedUser>(err: any, user: TUser): TUser {
    // If passport-jwt throws an error (e.g., TokenExpiredError), it will be in `err`.
    // If JwtStrategy.validate returns null/false, `user` will be falsy.
    // In either case, authentication has failed.
    if (err || !user) {
      // wrap the original error message or provide a generic one in our custom exception.
      const message = this.i18nService.translate('UNAUTHORIZED');
      throw new BaseRpcException(message, ErrorCodes.UNAUTHORIZED, {
        cause: err,
      });
    }

    return user;
  }
}
