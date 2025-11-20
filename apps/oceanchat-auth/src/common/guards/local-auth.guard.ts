import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthenticatedUser, RequestLike } from '@ocean.chat/types';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(private readonly i18nService: I18nService) {
    super();
  }

  /**
   * override getRequest to extract username and password from the RPC context
   * @param context The execution context
   * @returns A request-like object with a body containing username and password
   */
  getRequest(context: ExecutionContext) {
    const data = context.switchToRpc().getData();
    // passport-local expects a request-like object with body containing username and password
    // var username = lookup(req.body, this._usernameField) || lookup(req.query, this._usernameField);
    // var password = lookup(req.body, this._passwordField) || lookup(req.query, this._passwordField);
    // above code from passport-local
    // So I need to wrap our data into a body property
    // Assuming data contains { username, password }
    // If your payload structure is different, adjust accordingly
    // For example, if data is { user: { username, password } }, then do:
    // const requestLike = { body: data.user };
    // Here I assume data itself has username and password directly
    const requestLike: RequestLike = { body: data };

    return requestLike;
  }

  /**
   * Override canActivate to add custom logic if needed
   * calls super.canActivate to get a request-like object, because passport-local is desined to work with HTTP requests, but here I are adapting it to work with RPC
   * then call getRequest to transform the RPC data into a request-like object
   * then call validate method of LocalStrategy with username and password extracted from the request-like object
   * @param context The execution context
   * @returns A boolean indicating whether the request is allowed to proceed
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  /**
   * Override handleRequest to manage the result of the authentication attempt.
   * The default implementation of passport-local attaches the user to `req.user`,
   * which is not what I want in an RPC context. I want to return the user object directly.
   * @param err - An error object if authentication fails.
   * @param user - The user object returned from the LocalStrategy's `validate` method on success.
   * @returns The user object.
   * @throws The error if authentication fails.
   */
  handleRequest(
    err: any,
    user: AuthenticatedUser,
    info: any,
    context: ExecutionContext,
  ): any {
    if (err || !user) {
      const message = this.i18nService.translate('UNAUTHORIZED');
      throw new BaseRpcException(
        message,
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        {
          cause: err || info,
        },
      );
    }

    const data: AuthenticatedUser = context.switchToRpc().getData();

    // must explicitly found the data properties, because default behavior of passport-local is to attach the user to req.user
    // but here is a RPC context, I want to return the user object directly
    // so I copy the properties from user to data;
    // the user object returned from LocalStrategy.validate is just can be used in http request context
    // I need to manually attach the user info to the RPC data object
    delete data['password']; // default behavior of passport-local is to attach the username and password to req.body, but I don't want to return the password for security reason
    data['username'] = user.username;
    data['_id'] = user._id;

    return user;
  }
}
