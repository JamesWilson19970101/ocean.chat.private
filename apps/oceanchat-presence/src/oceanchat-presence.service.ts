import { Injectable } from '@nestjs/common';

@Injectable()
export class OceanchatPresenceService {
  getHello(): string {
    return 'Hello World!';
  }
}
