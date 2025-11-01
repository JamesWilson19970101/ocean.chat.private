import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatUserService {
  getHello(): string {
    return 'Hello World!';
  }
}
