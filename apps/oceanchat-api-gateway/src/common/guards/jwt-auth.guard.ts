import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { BaseException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { IS_PUBLIC_KEY } from '@ocean.chat/cores';
import { I18nService } from '@ocean.chat/i18n';
import { IJwtPayload } from '@ocean.chat/types';
import { Request } from 'express';

import { TokenBlacklistService } from '../services/token-blacklist.service';

/**
 * JWT authentication guard for HTTP contexts in the API Gateway.
 * This guard will be applied globally, and routes marked with @SkipAuth() will bypass it.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly i18nService: I18nService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked with @SkipAuth()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // If public, skip authentication
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new BaseException(
        this.i18nService.translate('UNAUTHORIZED'),
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<IJwtPayload>(token, {
        publicKey: this.configService.get<string>('jwt.accessPublicKey'),
        algorithms: ['RS256'],
      });

      // Zero-I/O Authentication:
      // We only check if the mathematically valid token's JTI is in our local memory blacklist.
      const isRevoked = await this.tokenBlacklistService.isRevoked(payload.jti);

      if (isRevoked) {
        throw new BaseException(
          this.i18nService.translate('UNAUTHORIZED'),
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.UNAUTHORIZED,
        );
      }

      // Assign user payload to request
      request['user'] = {
        sub: payload.sub,
        username: payload.username,
        deviceId: payload.deviceId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new BaseException(
          this.i18nService.translate('TOKEN_EXPIRED'),
          HttpStatus.UNAUTHORIZED,
          ErrorCodes.ERROR_CODE_TOKEN_EXPIRED,
          { cause: error },
        );
      }

      throw new BaseException(
        this.i18nService.translate('UNAUTHORIZED'),
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
        { cause: error },
      );
    }

    return true; // Proceed with JWT authentication
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
