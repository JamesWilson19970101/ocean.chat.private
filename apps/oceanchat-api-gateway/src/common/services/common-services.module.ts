import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';

import { TokenBlacklistService } from './token-blacklist.service';

@Global()
@Module({
  imports: [
    // Register CacheModule globally so it can be used anywhere in the gateway
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  providers: [TokenBlacklistService],
  exports: [TokenBlacklistService],
})
export class CommonServicesModule {}
