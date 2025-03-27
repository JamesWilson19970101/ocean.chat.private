import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  currentEnv: string;
  private readonly logger = new Logger('testpino');

  constructor(private readonly configService: ConfigService) {
    // Access NODE_ENV
    this.currentEnv =
      this.configService.get<string>('NODE_ENV') || 'development';
    console.log(`Current Environment: ${this.currentEnv}`);

    // Check the Environment
    if (this.currentEnv === 'development') {
      console.log('You are in the development environment.');
    } else {
      console.log('You are in the production or other environment.');
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
