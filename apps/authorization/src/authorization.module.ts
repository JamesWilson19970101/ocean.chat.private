import { Module } from '@nestjs/common';
import { ModelsModule } from '@ocean.chat/models';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';

import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...(process.env.NODE_ENV !== 'production'
          ? {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              },
            }
          : {}),
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        serializers: {
          req: (req: IncomingMessage & { id?: number | string }) => {
            // Add type hint for req
            return {
              id: req.id,
              method: req.method,
              url: req.url,
            };
          },
          res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        },
      },
    }),

    DatabaseModule,
    ModelsModule,
  ],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
})
export class AuthorizationModule {}
