import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { OceanchatAuthModule } from './oceanchat-auth.module';

async function bootstrap() {
  // Create a pure microservice that listens on NATS
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OceanchatAuthModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
      },
      bufferLogs: true,
    },
  );

  // Use the Pino logger instance from the app container
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Start the microservice and listen for incoming messages
  await app.listen();
  app
    .get(Logger)
    .log(
      `Oceanchat-auth microservice is listening on NATS server: ${process.env.NATS_URL || 'nats://localhost:4222'}`,
    );
}
bootstrap().catch((error) => {
  // A basic logger for bootstrap errors, as the main logger might not be available
  if (error instanceof Error) {
    console.error(
      `[Bootstrap Error] Failed to start microservice: ${error.message}`,
      error.stack,
    );
  } else {
    console.error(
      '[Bootstrap Error] Failed to start microservice with a non-error:',
      error,
    );
  }
});
