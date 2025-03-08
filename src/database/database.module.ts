import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../config/configuration';
import { validationSchema } from '../config/validation';
import { Env } from '../config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      validationSchema,
      envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        dbName: configService.get<string>('database.name'),
        serverSelectionTimeoutMS: 5000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
