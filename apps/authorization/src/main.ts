import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AuthorizationModule } from './authorization.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthorizationModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.AUTHORIZATION_PORT ?? 3002);
}
bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
});
