import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import configuration from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      validationSchema,
      envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
    }),
    DatabaseModule,
  ],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
