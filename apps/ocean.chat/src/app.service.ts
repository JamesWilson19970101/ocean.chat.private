import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from '@ocean.chat/i18n';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class AppService implements OnModuleInit {
  currentEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger('ocean.chat.app.module')
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit() {
    // Access NODE_ENV
    this.currentEnv =
      this.configService.get<string>('NODE_ENV') || 'development';

    this.logger.info(
      this.i18nService.translate('Current_Environment', {
        env: this.currentEnv,
      }),
    );
  }

  getHello(): string {
    return 'Hello World!';
  }
}
