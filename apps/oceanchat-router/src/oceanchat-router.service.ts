import { Injectable } from '@nestjs/common';

interface HelloReply {
  message: string;
}

@Injectable()
export class OceanchatRouterService {
  getHello(): HelloReply {
    return { message: 'Hello World!' };
  }
}
