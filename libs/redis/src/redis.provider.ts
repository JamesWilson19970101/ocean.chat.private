import { Provider } from '@nestjs/common';
import { I18nService } from '@ocean.chat/i18n';
import Redis, { RedisOptions } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';

import { RedisModuleAsyncOptions, RedisModuleOptions } from './redis.interface';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export type RedisClient = Redis;

export const createProviders = (options: RedisModuleOptions): Provider[] => {
  return [
    {
      provide: REDIS_CLIENT,
      useFactory: (
        logger: PinoLogger,
        i18nService: I18nService,
      ): RedisClient => {
        logger.setContext('redis.provider');
        const client = new Redis(options);

        client.on('connect', () => {
          logger.info(i18nService.translate('Redis_Client_Connected'));
        });

        client.on('ready', () => {
          logger.info(i18nService.translate('Redis_Client_Ready'));
        });

        client.on('error', (error) => {
          logger.error(
            { err: error },
            i18nService.translate('Redis_Client_Error'),
          );
        });
        return client;
      },
      inject: [PinoLogger, I18nService],
    },
  ];
};

export const createAsyncProviders = (options: RedisModuleAsyncOptions) => {
  return [
    {
      provide: REDIS_CLIENT,
      useFactory: async (
        logger: PinoLogger,
        i18nService: I18nService,
        ...args: any[]
      ): Promise<RedisClient> => {
        logger.setContext('redis.provider');
        if (!options.useFactory) {
          throw new Error('useFactory is required');
        }
        const redisOptions: RedisOptions = await options.useFactory(...args);
        const client = new Redis(redisOptions);

        client.on('connect', () => {
          logger.info(i18nService.translate('Redis_Client_Connected'));
        });
        client.on('ready', () => {
          logger.info(i18nService.translate('Redis_Client_Ready'));
        });
        client.on('error', (error) => {
          logger.error(
            { err: error },
            i18nService.translate('Redis_Client_Error'),
          );
        });
        return client;
      },
      inject: [PinoLogger, I18nService, ...(options.inject || [])],
    },
  ];
};
