import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { AccountService } from './account.service';
import { SignInDto, SignUpDto } from './dtos/account.dto';
@Controller()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  getHello(): string {
    return this.accountService.getHello();
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.accountService.signIn(signInDto.username, signInDto.password);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.accountService.signUp(signUpDto);
  }
}
