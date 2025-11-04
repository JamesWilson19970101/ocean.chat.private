import { startTracing } from '@ocean.chat/tracing';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-auth';
const serviceInstanceId = randomUUID();
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application
propagation.setGlobalPropagator(new W3CTraceContextPropagator()); // This ensures that all OpenTelemetry API calls (such as inject and extract) use W3C standards.
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { OceanchatAuthModule } from './oceanchat-auth.module';

async function bootstrap() {
  console.log(`
   ____   _____ ______          _   _      _____ _    _       _______     _____ __  __
  / __ \\ / ____|  ____|   /\\   | \\ | |    / ____| |  | |   /\\|__   __|   |_   _|  \\/  |
 | |  | | |    | |__     /  \\  |  \\| |   | |    | |__| |  /  \\  | |        | | | \\  / |
 | |  | | |    |  __|   / /\\ \\ | . \` |   | |    |  __  | / /\\ \\ | |        | | | |\\/| |
 | |__| | |____| |____ / ____ \\| |\\  |   | |____| |  | |/ ____ \\| |       _| |_| |  | |
  \\____/ \\_____|______/_/    \\_\\_| \\_|    \\_____|_|  |_/_/    \\_\\_|      |_____|_|  |_|
  `);
  // Create a pure microservice that listens on NATS
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OceanchatAuthModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'oceanchat-auth',
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
