import { startTracing } from '@ocean.chat/tracing';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';

const serviceName = 'oceanchat-presence';
const serviceInstanceId = randomUUID();
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { OceanchatPresenceModule } from './oceanchat-presence.module';

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
    OceanchatPresenceModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'oceanchat-presence', // Queue group for load balancing standard NATS messages
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

  // Process-Level Backup (Runtime Protection)
  process.on('unhandledRejection', (reason) => {
    try {
      logger.error({ err: reason }, '[Unhandled Rejection]');
    } catch {
      emergencyLog('Unhandled Rejection', reason);
    }
  });

  process.on('uncaughtException', (err) => {
    try {
      logger.error({ err }, '[Uncaught Exception] Exiting...');
    } catch {
      emergencyLog('Uncaught Exception', err);
    }
    process.exit(1);
  });

  // Start the microservice and listen for incoming messages
  await app.listen();
  logger.log(`[${serviceName}] Microservice started successfully`);
}

// Intercepting NestJS initialization failed.
bootstrap().catch((error) => {
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
