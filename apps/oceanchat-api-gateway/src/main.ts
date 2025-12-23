import { startTracing } from '@ocean.chat/tracing';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-api-gateway';
const serviceInstanceId = randomUUID();
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application
propagation.setGlobalPropagator(new W3CTraceContextPropagator()); // This ensures that all OpenTelemetry API calls (such as inject and extract) use W3C standards.

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { OceanchatApiGatewayModule } from './oceanchat-api-gateway.module';

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

  const app = await NestFactory.create<NestExpressApplication>(
    OceanchatApiGatewayModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      bufferLogs: true,
    },
  );

  const logger = app.get(Logger);
  app.useLogger(logger);

  // Security Middleware
  app.use(helmet());

  // Enable CORS to allow frontend requests
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*', // In production, replace '*' with actual frontend domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Trust the proxy (Ingress/Nginx/LoadBalancer) to get the real client IP via X-Forwarded-For.
  // Without this, rate limiting will block the LoadBalancer's IP, affecting all users.
  app.set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Set request body size limit to prevent DoS attacks (e.g., large payloads causing OOM)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Process-Level Backup (Runtime Protection)
  // For example, an error was thrown in a Cron Job; Call NATS to publish a message but forget to write the .catch() block, and NATS crashes.

  // Capture unprocessed Promises (Fire-and-forget omissions)
  // Corresponding scenarios: Forget about async functions that use await and don't have catch.
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

  await app.listen(process.env.OCEANCHAT_API_GATEWAY_PORT ?? 1994);
}
// Intercepting NestJS initialization failed.
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
