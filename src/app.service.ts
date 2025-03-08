import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  currentEnv: string;
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

    // Example of accessing other config variables:
    const databaseUri = this.configService.get<string>('database.uri');
    const databaseName = this.configService.get<string>('database.name');
    console.log(`Database URI: ${databaseUri}`);
    console.log(`Database Name: ${databaseName}`);
  }

  getHello(): string {
    return 'Hello World!';
  }
}
