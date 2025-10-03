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
  JWT_SECRET: Joi.string().required().messages({
    'string.empty': 'JWT_SECRET is required',
    'any.required': 'JWT_SECRET is required',
  }),
});
