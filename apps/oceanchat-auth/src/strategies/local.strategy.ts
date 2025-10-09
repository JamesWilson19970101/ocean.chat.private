import { Injectable, Logger } from '@nestjs/common'; // <-- 引入 Logger
import { PassportStrategy } from '@nestjs/passport';
import { BaseRpcException, ErrorCodes } from '@ocean.chat/common-exceptions';
import { AuthProvider, User } from '@ocean.chat/models';
import { Strategy } from 'passport-local';

import { UsersService } from '../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  // 注入 Logger
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly usersService: UsersService) {
    super();
  }

  async validate(username: string, password: string): Promise<Partial<User>> {
    this.logger.debug(
      `--- LocalStrategy.validate() called for user: ${username} ---`,
    );

    const userWithPassword =
      await this.usersService.findOneByUsernameAndProvider(
        username,
        AuthProvider.LOCAL,
      );

    // 日志 1: 看看我们是否找到了用户
    this.logger.debug(`User found in DB: ${JSON.stringify(userWithPassword)}`);

    if (!userWithPassword) {
      this.logger.warn('User not found. Throwing exception...');
      throw new BaseRpcException(
        'Invalid credentials',
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }

    const isPasswordValid = await this.usersService.verifyPassword(
      password,
      userWithPassword.passwordHash,
    );

    // 日志 2: 看看密码验证的结果是什么
    this.logger.debug(`Password verification result: ${isPasswordValid}`);

    if (!isPasswordValid) {
      this.logger.warn('Password is not valid. Throwing exception...');
      throw new BaseRpcException(
        'Invalid credentials',
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }

    // 日志 3: 如果一切正常，我们应该会走到这里
    this.logger.debug('Validation successful. Returning user object.');
    const { _id } = userWithPassword;
    return { username, _id };
  }
}
