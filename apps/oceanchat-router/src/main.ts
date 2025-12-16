import { startTracing } from '@ocean.chat/tracing';
import { randomUUID } from 'crypto';
const serviceInstanceId = randomUUID();
const serviceName = 'oceanchat-router';
startTracing(serviceName, serviceInstanceId); // Initialize OpenTelemetry Tracing at the very begining of the application
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

import { OceanchatRouterModule } from './oceanchat-router.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OceanchatRouterModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'oceanchat_router',
        protoPath: join(
          __dirname,
          '../../../oceanchat_router_assets/oceanchat-router.proto',
        ),
        url: process.env.GRPC_URL ?? '0.0.0.0:50051',
      },
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
