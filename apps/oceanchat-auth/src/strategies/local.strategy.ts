import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@ocean.chat/models';
import { Strategy } from 'passport-local';

import { UsersService } from '../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async validate(
    username: string,
    password: string,
  ): Promise<Partial<User> | null> {
    const user = await this.usersService.validatePassword(username, password);

    // The strategy's responsibility is to validate credentials and return the user or null.
    // It should not be concerned with throwing business-specific exceptions.
    // The guard's handleRequest method will handle the null case.
    return user || null;
  }
}
