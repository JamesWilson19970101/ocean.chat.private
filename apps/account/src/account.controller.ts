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
import { Public } from './decorators/public.decorator';
import { SignInDto, SignUpDto } from './dtos/account.dto';

@ApiBearerAuth()
@ApiTags('authentication')
@Controller()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({ status: 200, description: 'Hello World.' })
  @Get()
  @Public()
  getHello(): string {
    return this.accountService.getHello();
  }

  @ApiOperation({ summary: 'User login' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @Public()
  signIn(@Body() signInDto: SignInDto) {
    return this.accountService.signIn(signInDto.username, signInDto.password);
  }

  @ApiOperation({ summary: 'User signUp' })
  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  @Public()
  signUp(@Body() signUpDto: SignUpDto) {
    return this.accountService.signUp(signUpDto);
  }
}
