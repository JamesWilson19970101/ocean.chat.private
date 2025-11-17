import { Controller, Get } from '@nestjs/common';

import { OceanchatGroupService } from './oceanchat-group.service';

@Controller()
export class OceanchatGroupController {
  constructor(private readonly oceanchatGroupService: OceanchatGroupService) {}

  @Get()
  getHello(): string {
    return this.oceanchatGroupService.getHello();
  }
}
