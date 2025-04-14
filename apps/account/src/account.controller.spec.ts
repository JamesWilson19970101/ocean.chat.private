import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ModelsModule } from '@ocean.chat/models';

import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import configuration from './config/configuration';
import { Env } from './config/env';
import { validationSchema } from './config/validation';
import { jwtConstants } from './constants';
import { DatabaseModule } from './database/database.module';

describe('AccountController', () => {
  let accountController: AccountController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [AccountService],
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
          validationSchema,
          envFilePath: `.env.${process.env.NODE_ENV || Env.Development}`,
        }),
        DatabaseModule,
        ModelsModule,
        JwtModule.register({
          global: true,
          secret: jwtConstants.secret,
          signOptions: { expiresIn: '600s' },
        }),
      ],
    }).compile();

    accountController = app.get<AccountController>(AccountController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(accountController.getHello()).toBe('Hello World!');
    });
  });
});
