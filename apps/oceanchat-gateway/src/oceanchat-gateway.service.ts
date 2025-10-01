import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatGatewayService {
  getHello(): string {
    return 'Hello World!';
  }
}
