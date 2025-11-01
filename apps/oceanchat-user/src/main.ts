import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-user';
const serviceInstanceId = randomUUID();

import { NestFactory } from '@nestjs/core';

import { OceanchatUserModule } from './oceanchat-user.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatUserModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap().catch((error) => {
  // A basic logger for bootstrap errors, as the main logger might not be available
  if (error instanceof Error) {
    console.error(
      `[Bootstrap Error][${serviceName}::${serviceInstanceId}] Failed to start microservice: ${error.message}`,
      error.stack,
    );
  } else {
    console.error(
      `[Bootstrap Error][${serviceName}::${serviceInstanceId}] Failed to start microservice with a non-error:`,
      error,
    );
  }
});
