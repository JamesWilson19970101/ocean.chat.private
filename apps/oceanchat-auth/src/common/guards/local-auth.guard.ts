import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
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
    // So we need to wrap our data into a body property
    // Assuming data contains { username, password }
    // If your payload structure is different, adjust accordingly
    // For example, if data is { user: { username, password } }, then do:
    // const requestLike = { body: data.user };
    // Here we assume data itself has username and password directly
    const requestLike = { body: data };

    return requestLike;
  }

  /**
   * Override canActivate to add custom logic if needed
   * calls super.canActivate to get a request-like object, because passport-local is desined to work with HTTP requests, but here we are adapting it to work with RPC
   * then call getRequest to transform the RPC data into a request-like object
   * then call validate method of LocalStrategy with username and password extracted from the request-like object
   * @param context The execution context
   * @returns A boolean indicating whether the request is allowed to proceed
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
