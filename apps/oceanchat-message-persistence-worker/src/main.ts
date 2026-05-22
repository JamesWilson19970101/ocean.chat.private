import { startTracing } from '@ocean.chat/tracing';
import { randomUUID } from 'crypto';
const serviceInstanceId = randomUUID();
const serviceName = 'oceanchat-message-persistence-worker';
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { OceanchatMessagePersistenceWorkerModule } from './oceanchat-message-persistence-worker.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OceanchatMessagePersistenceWorkerModule,
    {
      transport: Transport.TCP, // TCP doesn't matter much here since we just want it to run as a worker
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
