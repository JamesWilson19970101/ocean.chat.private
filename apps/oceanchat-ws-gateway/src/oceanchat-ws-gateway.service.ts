import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatWsGatewayService {
  getHello(): string {
    return 'Hello World!';
  }
}
