import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ModelsModule } from '@ocean.chat/models';

import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { jwtConstants } from './constants';
@Module({
  imports: [
    ModelsModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '600s' },
    }),
  ],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
})
export class AuthorizationModule {}
