import { NestFactory } from '@nestjs/core';
import { StreamModule } from './stream.module';

async function bootstrap() {
  const app = await NestFactory.create(StreamModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
