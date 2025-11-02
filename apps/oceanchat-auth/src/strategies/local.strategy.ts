import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { User } from '@ocean.chat/models';
import { Strategy } from 'passport-local';

import { UsersService } from '../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly i18nService: I18nService,
  ) {
    super();
  }

  async validate(username: string, password: string): Promise<Partial<User>> {
    const user = await this.usersService.validatePassword(username, password);

    if (!user) {
      throw new BaseRpcException(
        this.i18nService.translate('INVALID_CREDENTIALS'),
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }

    // The user object returned from validatePassword is already a partial.
    return user;
  }
}
