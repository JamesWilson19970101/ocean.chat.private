import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@ocean.chat/models';

import { UsersService } from './users/users.service';
@Injectable()
export class OceanchatAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generates a JWT for a given user.
   * This is called by the AuthController after the LocalStrategy has successfully validated the user.
   * @param user The user object, validated by LocalStrategy.
   * @returns An object containing the access token and user information.
   */
  async login(
    user: Pick<User, '_id' | 'username'>,
  ): Promise<{ accessToken: string; user: Pick<User, '_id' | 'username'> }> {
    const payload = { sub: user._id, username: user.username };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, user: user };
  }

  /**
   * Validates a JWT.
   * @param token The token to validate.
   * @returns The decoded payload if valid, otherwise null.
   */
  async validateToken(token: string): Promise<any> {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch {
      return null;
    }
  }
}
