import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { OceanchatRouterService } from './oceanchat-router.service';

interface HelloReply {
  message: string;
}

@Controller()
export class OceanchatRouterController {
  constructor(
    private readonly oceanchatRouterService: OceanchatRouterService,
  ) {}

  @GrpcMethod('OceanchatRouter', 'GetHello')
  getHello(): HelloReply {
    return this.oceanchatRouterService.getHello();
  }
}
