import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatApiGatewayService {
  getHello(): string {
    return 'Hello World!';
  }
}
