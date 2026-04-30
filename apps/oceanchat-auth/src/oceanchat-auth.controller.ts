import { Controller, UseGuards } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthenticatedUser } from '@ocean.chat/types';

import { CurrentUser } from './common/decorators/current-user.decorator';
import { LocalAuthGuard } from './common/guards/local-auth.guard';
import { OceanchatAuthService } from './oceanchat-auth.service';

@Controller()
export class OceanchatAuthController {
  constructor(private readonly oceanchatAuthService: OceanchatAuthService) {}

  /**
   * @param user - The user payload from the validated token, injected by the @validateUser decorator after the guard runs.
   * @returns The user's basic information if the token is valid.
   */
  @UseGuards(LocalAuthGuard)
  @MessagePattern('auth.login')
  async login(
    @CurrentUser()
    user: Pick<AuthenticatedUser, 'username' | '_id' | 'deviceId'>,
  ) {
    return this.oceanchatAuthService.login(user);
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

  /**
   * NATS message handler for user logout.
   */
  @MessagePattern('auth.logout')
  async logout(@Payload() payload: { userId: string; deviceId: string }) {
    return this.oceanchatAuthService.logout(payload.userId, payload.deviceId);
  }
}
