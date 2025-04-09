import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthorizationService {
  constructor() {}
  getHello(): string {
    return 'Hello World!';
  }
}
