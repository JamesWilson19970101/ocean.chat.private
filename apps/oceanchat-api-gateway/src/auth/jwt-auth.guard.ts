import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { Request } from 'express';
import { firstValueFrom, timeout } from 'rxjs';

import { IS_PUBLIC_KEY } from './decorators/skip-auth.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked as public with the @SkipAuth() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Grant access immediately if the route is public
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authorization token not found.');
    }

    try {
      // send token to auth service for validation by nats
      // convert Observable to Promise using firstValueFrom
      // add a 5 seconds timeout to prevent hanging if auth service is unresponsive
      const user = await firstValueFrom(
        this.authClient.send('auth.token.validate', token).pipe(timeout(5000)),
      );

      // if user is returned, authentication is successful
      if (user) {
        // attach user info to request object for further use in controllers
        request.user = user;
      }
    } catch {
      // nats error or auth service error
      throw new UnauthorizedException('validation of token failed.');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
