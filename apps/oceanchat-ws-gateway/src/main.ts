import { startTracing } from '@ocean.chat/tracing';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';
const serviceName = 'oceanchat-ws-gateway';
const serviceInstanceId = randomUUID();
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application
propagation.setGlobalPropagator(new W3CTraceContextPropagator()); // This ensures that all OpenTelemetry API calls (such as inject and extract) use W3C standards.

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { OceanchatWsGatewayModule } from './oceanchat-ws-gateway.module';
import { RateLimitedWsAdapter } from './rate-limited-ws-adapter';

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
    OceanchatWsGatewayModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      bufferLogs: true,
    },
  );

  // Use the Pino logger instance from the app container
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Mount the custom WebSocket Adapter to enforce distributed IP rate limiting
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.useWebSocketAdapter(new RateLimitedWsAdapter(app) as any);

  // Process-Level Backup (Runtime Protection)
  // Capture unprocessed Promises (Fire-and-forget omissions)
  process.on('unhandledRejection', (reason) => {
    try {
      logger.error({ err: reason }, '[Unhandled Rejection]');
    } catch {
      emergencyLog('Unhandled Rejection', reason);
    }
  });

  const envPort = parseInt(process.env.OCEANCHAT_WS_GATEWAY_PORT as string, 10);
  const listenPort = isNaN(envPort) ? 1996 : envPort;
  await app.listen(listenPort, '0.0.0.0');
  logger.log(`[${serviceName}] Service is listening on port ${listenPort}`);
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
