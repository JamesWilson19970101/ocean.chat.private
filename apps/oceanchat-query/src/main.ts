import { startTracing } from '@ocean.chat/tracing';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-query';
const serviceInstanceId = randomUUID();
startTracing(serviceName, serviceInstanceId);
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { OceanchatQueryModule } from './oceanchat-query.module';

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

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OceanchatQueryModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'oceanchat-query',
      },
      bufferLogs: true,
    },
  );

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

  await app.listen();
}

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
