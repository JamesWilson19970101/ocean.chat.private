import { Injectable } from '@nestjs/common';
import { DatabaseWatcher } from '@ocean.chat/models';

@Injectable()
export class StreamService {
  constructor(private readonly databaseWatcher: DatabaseWatcher) {}
  getHello(): string {
    return 'Hello World!';
  }
}
