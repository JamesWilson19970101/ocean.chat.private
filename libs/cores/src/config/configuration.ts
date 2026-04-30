import { registerAs } from '@nestjs/config';

export const databaseConfiguration = registerAs('database', () => ({
  uri: process.env.DATABASE_URI || 'mongodb://localhost:27017',
  name: process.env.DATABASE_NAME || 'oceanchat_development',
  fullDocument: process.env.DATABASE_FULL_DOCUMENT || 'updateLookup', // after update, return the full modified document rather than the original. Default is 'default' (equivalent to 'whenAvailable'), just inlude the change fields.
}));

export const redisConfiguration = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_DB || '2', 10),
}));

export const jwtConfiguration = registerAs('jwt', () => ({
  accessPublicKey: process.env.JWT_ACCESS_PUBLIC_KEY?.replace(/\\n/g, '\n'),
  accessPrivateKey: process.env.JWT_ACCESS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15Mins',
  refreshPublicKey: process.env.JWT_REFRESH_PUBLIC_KEY?.replace(/\\n/g, '\n'),
  refreshPrivateKey: process.env.JWT_REFRESH_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7Days',
}));

export const natsConfiguration = registerAs('nats', () => ({
  url: process.env.NATS_URL || 'nats://localhost:4222',
}));

export const restConfiguration = registerAs('rest', () => ({
  rate_limit: parseInt(process.env.REST_RATE_LIMIT || '10', 10),
}));

export const cacheConfiguration = registerAs('cache', () => ({
  maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '100000', 10),
}));
