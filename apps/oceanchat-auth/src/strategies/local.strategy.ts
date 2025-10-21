import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { I18nService } from '@ocean.chat/i18n';
import { AuthProvider, User } from '@ocean.chat/models';
import { Types } from 'mongoose';
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
    const userWithPassword =
      await this.usersService.findOneByUsernameAndProvider(
        username,
        AuthProvider.LOCAL,
      );

    if (!userWithPassword) {
      throw new BaseRpcException(
        this.i18nService.translate('User_not_found'),
        ErrorCodes.USER_NOT_FOUND,
      );
    }

    const isPasswordValid = await this.usersService.verifyPassword(
      password,
      userWithPassword.providers[0].passwordHash!, // Non-null assertion because I know it exists, when code reaches here, it must exist
    );

    if (!isPasswordValid) {
      throw new BaseRpcException(
        this.i18nService.translate('INVALID_CREDENTIALS'),
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }

    const _id: Types.ObjectId = userWithPassword._id as Types.ObjectId;
    return { username, _id: _id.toString() };
  }
}
