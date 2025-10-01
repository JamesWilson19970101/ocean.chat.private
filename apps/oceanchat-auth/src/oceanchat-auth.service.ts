import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatAuthService {
  getHello(): string {
    return 'Hello World!';
  }
}
