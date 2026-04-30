import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-auth';
const serviceInstanceId = randomUUID();
import { NestFactory } from '@nestjs/core';

import { OceanchatGroupModule } from './oceanchat-group.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatGroupModule);
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
