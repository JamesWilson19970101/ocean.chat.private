import { Injectable, OnModuleInit } from '@nestjs/common';
import { defaultRoles, permissions } from '@ocean.chat/authorization';
import { I18nService } from '@ocean.chat/i18n';
import { PermissionRepository, RoleRepository } from '@ocean.chat/models';
import { RedisService } from '@ocean.chat/redis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class PermissionSeederService implements OnModuleInit {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly redisService: RedisService,
    private readonly i18nService: I18nService,
    @InjectPinoLogger(PermissionSeederService.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const lockKey = 'seeder:lock:permissions';
    const lockToken = uuidv7();
    const lockTtlSeconds = 60;

    // Distributes lock to ensure only one pod seeds permissions
    const isLockAcquired = await this.redisService.setnx(
      lockKey,
      lockToken,
      lockTtlSeconds,
    );

    if (isLockAcquired !== 'OK') {
      this.logger.info(
        this.i18nService.translate('Seeding_Permissions_Skipped'),
      );
      return;
    }

    this.logger.info(this.i18nService.translate('Seeding_Permissions_Started'));

    let watchdogTimer: NodeJS.Timeout | undefined;

    try {
      // Watchdog mechanism: Prevent lock from releasing prematurely
      watchdogTimer = setInterval(
        () => {
          this.redisService.expire(lockKey, lockTtlSeconds).catch((err) => {
            this.logger.error(
              { err, lockKey },
              this.i18nService.translate(
                'Watchdog_Renew_Permission_Lock_Failed',
              ),
            );
          });
          this.logger.debug(
            this.i18nService.translate(
              'Watchdog_Renew_Permission_Lock_Success',
            ),
          );
        },
        (lockTtlSeconds * 1000) / 2,
      );

      // 1. Synchronize default roles.
      for (const role of defaultRoles) {
        await this.roleRepository.upsert(
          role.name,
          role.description,
          role.scope,
        );
      }

      // 2. Synchronize default permissions.
      for (const perm of permissions) {
        await this.permissionRepository.upsert(perm._id, perm.roles);
      }

      this.logger.info(
        {
          rolesCount: defaultRoles.length,
          permissionsCount: permissions.length,
        },
        this.i18nService.translate('Seeding_Permissions_Success'),
      );
    } catch (error) {
      this.logger.error(
        { err: error },
        this.i18nService.translate('Seeding_Permissions_Failed'),
      );
    } finally {
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
      }

      // Safely release the lock
      await this.redisService.delIfEqual(lockKey, lockToken).catch((err) => {
        this.logger.error(
          { err, lockKey },
          this.i18nService.translate('Release_Permission_Lock_Failed'),
        );
      });
    }
  }
}
