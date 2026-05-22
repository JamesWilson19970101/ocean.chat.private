import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { TokenBlacklistService } from '@ocean.chat/cores';
import { IRoleDataSource } from '@ocean.chat/types';

import { RpcRoleDataSource } from './rpc-role.data-source';

@Global()
@Module({
  imports: [
    // Register CacheModule globally so it can be used anywhere in the gateway
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  providers: [
    TokenBlacklistService,
    {
      provide: IRoleDataSource,
      useClass: RpcRoleDataSource,
    },
  ],
  exports: [TokenBlacklistService, IRoleDataSource],
})
export class CommonServicesModule {}
