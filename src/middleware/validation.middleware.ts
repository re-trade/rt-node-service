import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });

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
    const { error } = schema.validate(req.params, { abortEarly: false });

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
    const { error } = schema.validate(req.query, { abortEarly: false });

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

const commonSchemas = {
  uuid: Joi.string().uuid(),
  timestamp: Joi.date().iso(),
  pagination: {
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
  },
};

export const chatSchemas = {
  roomId: Joi.object({
    roomId: commonSchemas.uuid.required(),
  }),

  createRoom: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    isPrivate: Joi.boolean().default(false),
  }),

  pagination: Joi.object(commonSchemas.pagination),

  sendMessage: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    roomId: commonSchemas.uuid.required(),
  }),

  authenticate: Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(50).required(),
  }),
};

export const videoSchemas = {
  createRoom: Joi.object({
    maxParticipants: Joi.number().integer().min(2).max(10).default(4),
    name: Joi.string().min(1).max(100).required(),
  }),

  roomId: Joi.object({
    roomId: commonSchemas.uuid.required(),
  }),

  sessionId: Joi.object({
    sessionId: commonSchemas.uuid.required(),
  }),

  recordingId: Joi.object({
    recordingId: commonSchemas.uuid.required(),
  }),

  initiateCall: Joi.object({
    recipientId: commonSchemas.uuid.required(),
    roomId: commonSchemas.uuid.required(),
  }),
};
