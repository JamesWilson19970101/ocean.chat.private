import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  await app.listen(process.env.OCEAN_CHAT_PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
});
