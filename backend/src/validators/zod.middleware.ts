// ===========================================
// Zod Validation Middleware
// ===========================================
// Type-safe request validation using Zod

import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema, type ZodError } from "zod";
import { sendValidationError } from "../utils/response.js";
import type { ValidationError } from "../types/api.types.js";

/**
 * Format Zod errors to our standard validation error format
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    value: undefined,
  }));
}

/**
 * Validate request body against a Zod schema
 * @param schema - Zod schema to validate against
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(res, formatZodErrors(error));
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate request query parameters against a Zod schema
 * @param schema - Zod schema to validate against
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      req.query = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(res, formatZodErrors(error));
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate request params against a Zod schema
 * @param schema - Zod schema to validate against
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.params);
      req.params = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(res, formatZodErrors(error));
        return;
      }
      next(error);
    }
  };
}

/**
 * Universal validation function with location support
 * @param schema - Zod schema to validate against
 * @param location - Where to validate: 'body', 'query', or 'params' (default: 'body')
 */
export function zodValidate<T extends ZodSchema>(schema: T, location: "body" | "query" | "params" = "body") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate = location === "body" ? req.body : location === "query" ? req.query : req.params;

      const parsed = await schema.parseAsync(dataToValidate);

      // Update the correct location with parsed data
      if (location === "body") {
        req.body = parsed;
      } else if (location === "query") {
        req.query = parsed as typeof req.query;
      } else {
        req.params = parsed as typeof req.params;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(res, formatZodErrors(error));
        return;
      }
      next(error);
    }
  };
}

/**
 * Combined validation for body, query, and params
 */
export function validateRequest<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
  TParams extends ZodSchema | undefined = undefined,
>(schemas: { body?: TBody; query?: TQuery; params?: TParams }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: ValidationError[] = [];

    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...formatZodErrors(error));
      }
    }

    try {
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...formatZodErrors(error));
      }
    }

    try {
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...formatZodErrors(error));
      }
    }

    if (errors.length > 0) {
      sendValidationError(res, errors);
      return;
    }

    next();
  };
}
