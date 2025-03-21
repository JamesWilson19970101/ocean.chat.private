import { NestFactory } from '@nestjs/core';
import { AuthorizationModule } from './authorization.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthorizationModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
