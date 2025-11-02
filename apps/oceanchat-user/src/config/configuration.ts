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

export const natsConfiguration = registerAs('nats', () => ({
  url: process.env.NATS_URL || 'nats://localhost:4222',
}));
