import { Injectable } from '@nestjs/common';

@Injectable()
export class StreamService {
  getHello(): string {
    return 'Hello World!';
  }
}
