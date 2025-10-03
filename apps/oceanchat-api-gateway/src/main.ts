import { NestFactory } from '@nestjs/core';

import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OceanchatApiGatewayModule } from './oceanchat-api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatApiGatewayModule);
  // Set the JwtAuthGuard as a global guard.
  // All endpoints will be protected by default.
  app.useGlobalGuards(app.get(JwtAuthGuard));

  await app.listen(process.env.OCEANCHAT_API_GATEWAY_PORT ?? 3000);
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
