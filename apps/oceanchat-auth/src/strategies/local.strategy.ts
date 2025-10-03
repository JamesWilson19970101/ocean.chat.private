import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { AuthProvider, User } from '@ocean.chat/models';
import { Strategy } from 'passport-local';

import { UsersService } from '../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'username' });
  }

  async validate(username: string, password: string): Promise<Partial<User>> {
    const userWithPassword =
      await this.usersService.findOneByUsernameAndProvider(
        username,
        AuthProvider.LOCAL,
      );

    if (
      !userWithPassword ||
      !(await this.usersService.verifyPassword(
        password,
        userWithPassword.passwordHash,
      ))
    ) {
      throw new BaseRpcException(
        'Invalid credentials',
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }
    const { _id } = userWithPassword;
    return { username, _id };
  }
}
