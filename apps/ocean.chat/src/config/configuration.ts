import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.DATABASE_URI || 'mongodb://localhost:27017',
  name: process.env.DATABASE_NAME || 'oceanchat_development',
  fullDocument: process.env.DATABASE_FULL_DOCUMENT || 'updateLookup',
}));
