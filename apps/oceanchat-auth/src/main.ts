import { NestFactory } from '@nestjs/core';

import { OceanchatAuthModule } from './oceanchat-auth.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatAuthModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
