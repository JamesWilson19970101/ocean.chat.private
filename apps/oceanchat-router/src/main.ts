import { NestFactory } from '@nestjs/core';

import { OceanchatRouterModule } from './oceanchat-router.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatRouterModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch((error) => {
  if (error instanceof Error) {
    console.error(
      `Failed to bootstrap application: ${error.message}`,
      error.stack,
    );
  } else {
    console.error('Failed to bootstrap application with a non-error:', error);
  }
});
