import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatMessageService {
  getHello(): string {
    return 'Hello World!';
  }
}
