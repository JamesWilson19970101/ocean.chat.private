import { Controller, Get } from '@nestjs/common';

import { OceanchatAuthService } from './oceanchat-auth.service';

@Controller()
export class OceanchatAuthController {
  constructor(private readonly oceanchatAuthService: OceanchatAuthService) {}

  @Get()
  getHello(): string {
    return this.oceanchatAuthService.getHello();
  }
}
