// /home/seconp/ocean.chat.private/src/auth/auth.module.ts
// TODO： add jwt
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { WechatStrategy } from './strategies/wechat.strategy';
//import {UsersModule} from "../users/users.module"; // Uncomment if needed

@Module({
  //imports: [UsersModule,
  imports: [
    ConfigModule, // Import ConfigModule to access configuration
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'), // Get the JWT secret from configuration
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'), // Get the JWT expiration time from configuration
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, WechatStrategy],
  exports: [AuthService], // Export AuthService if it's needed elsewhere
})
export class AuthModule {}
