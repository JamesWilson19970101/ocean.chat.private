import { Controller, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@ocean.chat/models';

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
  @UseGuards(AuthGuard('local'))
  @MessagePattern('auth.login')
  async login(@Payload() user: Pick<User, '_id' | 'username'>) {
    return this.oceanchatAuthService.login(user);
  }

  /**
   * NATS message handler for validating a JWT.
   * This is protected by the 'jwt' strategy guard.
   * The guard will automatically validate the token using JwtStrategy.
   * @param payload - The decoded payload from the validated token, attached by Passport.
   */
  @UseGuards(AuthGuard('jwt'))
  @MessagePattern('auth.token.validate')
  // eslint-disable-next-line @typescript-eslint/require-await
  async validateToken(@Payload() payload: any) {
    // If the guard succeeds, the payload is already validated by JwtStrategy.
    // We can simply return it. The guard handles invalid/expired tokens.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return payload;
  }
}
