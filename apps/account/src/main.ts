import { NestFactory } from '@nestjs/core';

import { AccountModule } from './account.module';

async function bootstrap() {
  const app = await NestFactory.create(AccountModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch(console.error);
