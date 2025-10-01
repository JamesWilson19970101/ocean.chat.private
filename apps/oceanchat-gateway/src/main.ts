import { NestFactory } from '@nestjs/core';

import { OceanchatGatewayModule } from './oceanchat-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatGatewayModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
