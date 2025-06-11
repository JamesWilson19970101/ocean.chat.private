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
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),
  AUTHORIZATION_PORT: Joi.number().default(3002),
});
