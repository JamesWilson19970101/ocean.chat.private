import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { User } from '@ocean.chat/models';
import { Request } from 'express';
import { firstValueFrom, timeout } from 'rxjs';

import { SkipAuth } from './auth/decorators/skip-auth.decorator';

@Controller()
export class OceanchatApiGatewayController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  // This is a protected route. Since the guard is global,
  // no decorator is needed here. It's protected by default.
  @Get('profile')
  getProfile(@Req() req: Request) {
    // The JwtAuthGuard attaches the user info to req.user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return req.user;
  }

  /**
   * Handles user login requests.
   * This endpoint is public and does not require authentication.
   * It forwards the login credentials to the auth microservice.
   * @param loginDto - Contains username and password.
   * @returns The response from the auth service, typically including a JWT, or a validation error.
   */
  @SkipAuth()
  @Post('auth/login')
  async login(
    @Body() loginDto: Record<string, any>,
  ): Promise<
    | { accessToken: string; user: Pick<User, '_id' | 'username'> }
    | { error: string }
  > {
    return firstValueFrom<
      | { accessToken: string; user: Pick<User, '_id' | 'username'> }
      | { error: string }
    >(
      this.authClient
        .send<
          | { accessToken: string; user: Pick<User, '_id' | 'username'> }
          | { error: string }
        >('auth.login', loginDto)
        .pipe(timeout(5000)),
    );
  }

  /**
   * Handles user registration requests.
   * This endpoint is public.
   * It forwards the registration data to the auth microservice.
   * @param registerDto - Contains username and password for the new user.
   * @returns The newly created user's information, or a validation error.
   */
  @SkipAuth()
  @Post('auth/register')
  async register(@Body() registerDto: Record<string, any>) {
    // The payload for 'auth.register' should match the CreateUserDto in the auth service.
    // The auth service will handle the validation.
    return firstValueFrom<Partial<User>>(
      this.authClient.send('auth.register', registerDto).pipe(timeout(5000)),
    );
  }
}
