import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';

import { DatabaseService } from './database.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService, logger: PinoLogger) => ({
        uri: configService.get<string>('database.uri'),
        dbName: configService.get<string>('database.name'),
        serverSelectionTimeoutMS: 5000,
        onConnectionCreate: (connection: Connection) => {
          connection.on('connected', () => {
            logger.setContext('database.module');
            logger.info('Database connected successfully');
          });
          return connection;
        },
      }),
      inject: [ConfigService, PinoLogger],
    }),
  ],
  providers: [DatabaseService],
})
export class DatabaseModule {}
