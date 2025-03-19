import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.DATABASE_URI,
  name: process.env.DATABASE_NAME,
}));
