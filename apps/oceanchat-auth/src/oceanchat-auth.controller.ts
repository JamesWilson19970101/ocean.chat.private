import { Controller, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { User } from '@ocean.chat/models';

import {
  CurrentUser,
  validateUser,
} from './common/decorators/current-user.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LocalAuthGuard } from './common/guards/local-auth.guard';
import { OceanchatAuthService } from './oceanchat-auth.service';

@Controller()
export class OceanchatAuthController {
  constructor(private readonly oceanchatAuthService: OceanchatAuthService) {}

  /**
   * NATS message handler for user login.
   * This handler is protected by the 'local' strategy guard.
   * When a message is received on 'auth.login', the LocalStrategy's `validate` method is automatically executed.
   * @param user - The user object, populated by the LocalStrategy after successful validation.
   * @returns An object containing the access token and user information.
   */
  @UseGuards(LocalAuthGuard)
  @MessagePattern('auth.login')
  async login(@CurrentUser() user: Pick<User, 'username' | '_id'>) {
    return this.oceanchatAuthService.login(user);
  }

  /**
   * NATS message handler for validating a JWT.
   * This is protected by the 'jwt' strategy guard.
   * The guard will automatically validate the token using JwtStrategy.
   * @param user - The user payload from the validated token, injected by @CurrentUser.
   */
  @UseGuards(JwtAuthGuard)
  @MessagePattern('auth.token.validate')
  // eslint-disable-next-line @typescript-eslint/require-await
  async validateToken(@validateUser() user: Pick<User, 'username' | '_id'>) {
    // If the guard succeeds, the payload is already validated by JwtStrategy.
    // The @CurrentUser decorator extracts the user info. We simply return it.
    return user;
  }

  /**
   * NATS message handler for refreshing a JWT.
   * @param payload - The payload containing the refresh token.
   * @returns A new pair of access and refresh tokens.
   */
  @MessagePattern('auth.token.refresh')
  async refreshToken(@Payload('refreshToken') refreshToken: string) {
    return this.oceanchatAuthService.refreshToken(refreshToken);
  }

  @MessagePattern('auth.token.decode')
  decodeToken(@Payload('token') token: string) {
    // Note: This does not verify the token, it only decodes it.
    // For testing purposes only.
    return this.oceanchatAuthService.decodeToken(token);
  }
}
