import { NestFactory } from '@nestjs/core';

import { OceanchatPusherRealtimeModule } from './oceanchat-pusher-realtime.module';

async function bootstrap() {
  const app = await NestFactory.create(OceanchatPusherRealtimeModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
