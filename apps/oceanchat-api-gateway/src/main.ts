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
import { Logger } from 'nestjs-pino';

import { OceanchatApiGatewayModule } from './oceanchat-api-gateway.module';

async function bootstrap() {
  console.log(`
   ____   _____ ______          _   _      _____ _    _       _______     _____ __  __
  / __ \\ / ____|  ____|   /\\   | \\ | |    / ____| |  | |   /\\|__   __|   |_   _|  \\/  |
 | |  | | |    | |__     /  \\  |  \\| |   | |    | |__| |  /  \\  | |        | | | \\  / |
 | |  | | |    |  __|   / /\\ \\ | . \` |   | |    |  __  | / /\\ \\ | |        | | | |\\/| |
 | |__| | |____| |____ / ____ \\| |\\  |   | |____| |  | |/ ____ \\| |       _| |_| |  | |
  \\____/ \\_____|______/_/    \\_\\_| \\_|    \\_____|_|  |_/_/    \\_\\_|      |_____|_|  |_|
  `);

  const app = await NestFactory.create(
    OceanchatApiGatewayModule.forRoot({
      serviceName,
      serviceInstanceId,
    }),
    {
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.OCEANCHAT_API_GATEWAY_PORT ?? 1994);
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
