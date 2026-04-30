import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatGroupService {
  getHello(): string {
    return 'Hello World!';
  }
}
