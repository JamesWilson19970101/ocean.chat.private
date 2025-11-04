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
   * NATS message handler for validating a JWT. This provides a centralized,
   * authoritative validation endpoint for internal microservices. It is protected
   * by the 'jwt' strategy guard, which handles the actual validation logic.
   *
   * Use Cases:
   * 1.  **WebSocket Gateway (`oceanchat-ws-gateway`)**:
   *     - Used for one-time authentication when a client establishes a WebSocket connection.
   *     - The performance overhead of an RPC call is acceptable here because it happens only once per connection lifecycle.
   *     - This approach enhances security by not requiring the `ws-gateway` to hold the JWT secret.
   *
   * 2.  **High-Security Business Operations (Optional)**:
   *     - Internal services (e.g., `account-service`) can call this for a final, real-time check before executing critical operations (like account deletion).
   *     - This is a trade-off: it ensures the token is valid at the exact moment of the operation, at the cost of an extra network call.
   *
   * Note: This endpoint is NOT intended for high-frequency use by services like the `oceanchat-api-gateway`,
   * which should perform local JWT validation for every HTTP request to maintain low latency.
   *
   * @param user - The user payload from the validated token, injected by the @validateUser decorator after the guard runs.
   * @returns The user's basic information if the token is valid.
   */
  @UseGuards(LocalAuthGuard)
  @MessagePattern('auth.login')
  async login(@CurrentUser() user: Pick<User, 'username' | '_id'>) {
    return this.oceanchatAuthService.login(user);
  }

  /**
   * NATS message handler for validating a JWT. This provides a centralized,
   * authoritative validation endpoint for internal microservices. It is protected
   * by the 'jwt' strategy guard, which handles the actual validation logic.
   *
   * Use Cases:
   * 1.  **WebSocket Gateway (`oceanchat-ws-gateway`)**:
   *     - Used for one-time authentication when a client establishes a WebSocket connection.
   *     - The performance overhead of an RPC call is acceptable here because it happens only once per connection lifecycle.
   *     - This approach enhances security by not requiring the `ws-gateway` to hold the JWT secret.
   *
   * 2.  **High-Security Business Operations (Optional)**:
   *     - Internal services (e.g., `account-service`) can call this for a final, real-time check before executing critical operations (like account deletion).
   *     - This is a trade-off: it ensures the token is valid at the exact moment of the operation, at the cost of an extra network call.
   *
   * Note: This endpoint is NOT intended for high-frequency use by services like the `oceanchat-api-gateway`,
   * which should perform local JWT validation for every HTTP request to maintain low latency.
   *
   * @param user - The user payload from the validated token, injected by the @validateUser decorator after the guard runs.
   * @returns The user's basic information if the token is valid.
   */
  @UseGuards(JwtAuthGuard)
  @MessagePattern('auth.token.validate')
  // eslint-disable-next-line @typescript-eslint/require-await
  async validateToken(@validateUser() user: Pick<User, 'username' | '_id'>) {
    // If the guard succeeds, the payload is already validated by JwtStrategy.
    // The @CurrentUser decorator extracts the user info. I simply return it.
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
