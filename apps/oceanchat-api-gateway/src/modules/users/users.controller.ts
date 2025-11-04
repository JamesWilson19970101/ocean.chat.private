import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { User } from '@ocean.chat/models';
import { Request } from 'express';
import { firstValueFrom, timeout } from 'rxjs';

@Controller('users')
export class UsersController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  /**
   * Gets the profile of the currently authenticated user.
   * The user's basic info (id, username) is available from the JWT payload (req.user).
   * For a more detailed profile, we query the user microservice.
   */
  @Get('me')
  async getMyProfile(@Req() req: Request) {
    // req.user is populated by JwtAuthGuard from the token payload
    const { sub: userId } = req.user as { sub: string };

    // Call the user service to get the full, safe-to-expose profile
    return firstValueFrom(
      this.userClient
        .send<Partial<User> | null>('user.query.profile', { userId })
        .pipe(timeout(5000)),
    );
  }
}
