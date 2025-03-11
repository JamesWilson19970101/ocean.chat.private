import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'ocean/i18n';

@Injectable()
export class AppService {
  currentEnv: string;
  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
  ) {
    console.log(this.i18nService.translate('HELLO WORLD'));
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
