import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatRouterService {
  getHello(): string {
    return 'Hello World!';
  }
}
