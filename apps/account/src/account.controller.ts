import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AccountService } from './account.service';
import { SignInDto, SignUpDto } from './dtos/account.dto';

@ApiBearerAuth()
@ApiTags('authentication')
@Controller()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({ status: 200, description: 'Hello World.' })
  @Get()
  getHello(): string {
    return this.accountService.getHello();
  }

  @ApiOperation({ summary: 'User login' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.accountService.signIn(signInDto.username, signInDto.password);
  }

  @ApiOperation({ summary: 'User signUp' })
  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.accountService.signUp(signUpDto);
  }
}
