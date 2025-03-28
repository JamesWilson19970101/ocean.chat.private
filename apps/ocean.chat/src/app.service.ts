import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { t } from '@ocean.chat/i18n';
import { I18nService } from '@ocean.chat/i18n';

@Injectable()
export class AppService {
  currentEnv: string;
  private readonly logger = new Logger('ocean.chat.app.module');

  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
  ) {
    // Access NODE_ENV
    this.currentEnv =
      this.configService.get<string>('NODE_ENV') || 'development';

    // log environment
    this.logger.log(
      this.i18nService.translate('CURRENT_ENV', {
        environment: this.currentEnv,
      }),
    );
  }

  getHello(): string {
    return 'Hello World!';
  }
}
