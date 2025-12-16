import * as Joi from 'joi';

export const validationSchema = Joi.object({
  DATABASE_URI: Joi.string().required().messages({
    'string.empty': 'DATABASE_URI is required',
    'any.required': 'DATABASE_URI is required',
  }),
  DATABASE_NAME: Joi.string().required().messages({
    'string.empty': 'DATABASE_NAME is required',
    'any.required': 'DATABASE_NAME is required',
  }),
  REDIS_HOST: Joi.string().required().messages({
    'string.empty': 'REDIS_HOST is required',
    'any.required': 'REDIS_HOST is required',
  }),
  REDIS_PORT: Joi.number().required().messages({
    'number.base': 'REDIS_PORT must be a number',
    'any.required': 'REDIS_PORT is required',
  }),
  REDIS_DB: Joi.number().required().messages({
    'number.base': 'REDIS_DB must be a number',
    'any.required': 'REDIS_DB is required',
  }),
  JWT_ACCESS_SECRET: Joi.string().required().messages({
    'string.empty': 'JWT_ACCESS_SECRET is required',
    'any.required': 'JWT_ACCESS_SECRET is required',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15Mins').messages({
    'string.empty': 'JWT_ACCESS_EXPIRES_IN cannot be empty',
    'any.required': 'JWT_ACCESS_EXPIRES_IN is required',
  }),
  JWT_REFRESH_SECRET: Joi.string().required().messages({
    'string.empty': 'JWT_REFRESH_SECRET is required',
    'any.required': 'JWT_REFRESH_SECRET is required',
  }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7Days').messages({
    'string.empty': 'JWT_REFRESH_EXPIRES_IN cannot be empty',
    'any.required': 'JWT_REFRESH_EXPIRES_IN is required',
  }),
  NATS_URL: Joi.string().default('nats://localhost:4222').messages({
    'string.empty': 'NATS_URL cannot be empty',
    'any.required': 'NATS_URL is required',
  }),
  REST_RATE_LIMIT: Joi.number().default(10).messages({
    'string.empty': 'REST_RATE_LIMIT cannot be empty',
    'any.required': 'REST_RATE_LIMIT is required',
  }),
});
