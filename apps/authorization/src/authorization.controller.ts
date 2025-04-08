import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { AuthorizationService } from './authorization.service';
import { SignInDto } from './dtos/signIn.dto';

@Controller()
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get()
  getHello(): string {
    return this.authorizationService.getHello();
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.authorizationService.signIn(
      signInDto.username,
      signInDto.password,
    );
  }
}
