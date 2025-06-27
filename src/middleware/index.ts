import { Request, Response, NextFunction, RequestHandler } from 'express';
import Joi from 'joi';

// Type for async request handlers
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

// Async handler wrapper
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};

// Validation middleware
export const validateBody = (schema: Joi.ObjectSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params, { abortEarly: false });
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Parameter validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Query validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }
    next();
  };
};

// Common validation schemas
const commonSchemas = {
  uuid: Joi.string().uuid(),
  pagination: {
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
  },
};

// Chat validation schemas
export const chatSchemas = {
  roomId: Joi.object({
    roomId: commonSchemas.uuid.required(),
  }),

  createRoom: Joi.object({
    name: Joi.string().min(1).max(100).required(),
  }),

  pagination: Joi.object(commonSchemas.pagination),

  authenticate: Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(50).required(),
  }),

  message: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    roomId: commonSchemas.uuid.required(),
  }),
};

// Video validation schemas
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

// Export all middleware
export default {
  asyncHandler,
  errorHandler,
  notFoundHandler,
  validateBody,
  validateParams,
  validateQuery,
  chatSchemas,
  videoSchemas,
};
