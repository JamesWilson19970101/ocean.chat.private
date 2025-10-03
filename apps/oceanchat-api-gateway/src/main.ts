import { NestFactory } from '@nestjs/core';
import { OceanchatApiGatewayModule } from './oceanchat-api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatApiGatewayModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
