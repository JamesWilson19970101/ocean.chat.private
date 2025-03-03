// src/config/configuration.ts
import { config } from 'dotenv';
import * as path from 'path';
// 根据 NODE_ENV 加载不同的 .env 文件
const env = process.env.NODE_ENV || 'development'; // 默认是开发环境
const envPath = path.resolve(__dirname, `../../.env.${env}`);
const commonEnvPath = path.resolve(__dirname, '../../.env');

//先加载通用的配置
const commonEnvResult = config({ path: commonEnvPath });
if (commonEnvResult.error) {
  console.error('Error loading common .env file:', commonEnvResult.error);
}


export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000, // 从环境变量 PORT 获取端口，默认为 3000
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key', // JWT 密钥，建议使用环境变量配置
    expiresIn: process.env.JWT_EXPIRES_IN || '1h', // JWT 过期时间，默认为 1 小时
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id', //Google客户端id，建议使用环境变量配置
    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret', //Google客户端密钥，建议使用环境变量配置
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3000/auth/google/callback', //google 回调地址
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || 'your-wechat-app-id', //微信appId,建议使用环境变量配置
    appSecret: process.env.WECHAT_APP_SECRET || 'your-wechat-app-secret', //微信密钥，建议使用环境变量配置
    callbackUrl:
      process.env.WECHAT_CALLBACK_URL ||
      'http://localhost:3000/auth/wechat/callback', //微信回调地址
  },
});
