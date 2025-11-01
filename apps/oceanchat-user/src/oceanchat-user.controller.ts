import { Controller, Get } from '@nestjs/common';

import { OceanchatUserService } from './oceanchat-user.service';

@Controller()
export class OceanchatUserController {
  constructor(private readonly oceanchatUserService: OceanchatUserService) {}

  @Get()
  getHello(): string {
    return this.oceanchatUserService.getHello();
  }
}
