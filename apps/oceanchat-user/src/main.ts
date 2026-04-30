import { startTracing } from '@ocean.chat/tracing';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-user';
const serviceInstanceId = randomUUID();
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application
propagation.setGlobalPropagator(new W3CTraceContextPropagator()); // This ensures that all OpenTelemetry API calls (such as inject and extract) use W3C standards.
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { OceanchatUserModule } from './oceanchat-user.module';

// Helper to ensure logs are always JSON, even during crashes
const emergencyLog = (type: string, error: unknown) => {
  const logPayload = {
    level: 'error',
    timestamp: new Date().toISOString(),
    serviceName,
    serviceInstanceId,
    msg: `[${type}] ${error instanceof Error ? error.message : String(error)}`,
    err:
      error instanceof Error
        ? { stack: error.stack, message: error.message }
        : error,
  };
  // Write directly to stderr stream to bypass any buffering issues during crash
  process.stderr.write(JSON.stringify(logPayload) + '\n');
};

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
    OceanchatUserModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'oceanchat-user',
      },
      bufferLogs: true,
    },
  );

  // Use the Pino logger instance from the app container
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  process.on('unhandledRejection', (reason) => {
    // Try to use the Pino logger if available, otherwise fallback to JSON stdout
    try {
      logger.error({ err: reason }, '[Unhandled Rejection]');
    } catch {
      emergencyLog('Unhandled Rejection', reason);
    }
    // Usually, the process does not exit
  });
  // Catch uncaught exceptions (serious code logic errors)
  // Corresponding scenarios: throw in setTimeout, or serious errors in synchronous code logic.
  process.on('uncaughtException', (err) => {
    try {
      logger.error({ err }, '[Uncaught Exception] Exiting...');
    } catch {
      emergencyLog('Uncaught Exception', err);
    }
    // In this situation, must exit and restart the service.
    process.exit(1);
  });

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
