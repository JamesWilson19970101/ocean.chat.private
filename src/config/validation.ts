import * as Joi from 'joi';

export const validationSchema = Joi.object({
  DATABASE_URI: Joi.string()
    .required()
    .error(new Error('DATABASE_URI is required')),
  DATABASE_NAME: Joi.string()
    .required()
    .error(new Error('DATABASE_NAME is required')),
});
