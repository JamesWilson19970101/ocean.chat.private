import { NestFactory } from '@nestjs/core';

import { AccountModule } from './account.module';

async function bootstrap() {
  const app = await NestFactory.create(AccountModule);
  await app.listen(process.env.ACCOUNTS_PORT ?? 3001);
}
bootstrap().catch(console.error);
