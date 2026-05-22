import { startTracing } from '@ocean.chat/tracing';
import { randomUUID } from 'crypto';
const serviceInstanceId = randomUUID();
const serviceName = 'oceanchat-orchestrator';
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { OceanchatOrchestratorModule } from './oceanchat-orchestrator.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OceanchatOrchestratorModule,
    {
      transport: Transport.TCP,
    },
  );
  await app.listen();
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
