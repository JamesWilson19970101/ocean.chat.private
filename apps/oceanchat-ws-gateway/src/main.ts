import { NestFactory } from '@nestjs/core';

import { OceanchatWsGatewayModule } from './oceanchat-ws-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatWsGatewayModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
