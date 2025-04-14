import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '@ocean.chat/models';

import { PasswordUtils } from './utils/password.utils';

@Injectable()
export class AccountService {
  constructor(
    private jwtService: JwtService,
    private userDoc: UserRepository,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async signIn(
    username: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const user = await this.userDoc.findByUsername(username);
    if (
      !user ||
      !(await PasswordUtils.verifyPassword(
        password,
        user.credentials.passwordHash,
      ))
    ) {
      throw new UnauthorizedException();
    }

    const payload = { sub: user._id, username: user.username };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async signUp(signUpDto: {
    email: string;
    password: string;
    username?: string;
  }) {
    const { email, password, username } = signUpDto;
    const salt = PasswordUtils.generateSalt();
    const hashedPassword = await PasswordUtils.hashPassword(password, salt);
    const user = {
      email,
      ...(username === undefined && { username: email }),
      credentials: {
        passwordHash: hashedPassword,
      },
    };

    return await this.userDoc.create(user);
  }
}
