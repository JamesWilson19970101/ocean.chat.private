import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { StreamModule } from './stream.module';

async function bootstrap() {
  const app = await NestFactory.create(StreamModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
