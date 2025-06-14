import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Parameter validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Query validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    next();
  };
};

export const schemas = {
  roomId: Joi.object({
    roomId: Joi.string().uuid().required(),
  }),

  createRoom: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    isPrivate: Joi.boolean().default(false),
    maxParticipants: Joi.number().integer().min(2).max(10).default(4),
  }),

  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  sendMessage: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    roomId: Joi.string().uuid().required(),
    type: Joi.string().valid('text', 'image', 'file').default('text'),
  }),
};
