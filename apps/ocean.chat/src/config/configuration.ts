import { registerAs } from '@nestjs/config';

export const databaseConfiguration = registerAs('database', () => ({
  uri: process.env.DATABASE_URI || 'mongodb://localhost:27017',
  name: process.env.DATABASE_NAME || 'oceanchat_development',
  fullDocument: process.env.DATABASE_FULL_DOCUMENT || 'updateLookup',
}));

export const redisConfiguration = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}));
