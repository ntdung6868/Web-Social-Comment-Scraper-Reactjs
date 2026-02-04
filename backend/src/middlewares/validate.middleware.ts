// ===========================================
// Validation Middleware
// ===========================================
// Request validation using express-validator

import type { Request, Response, NextFunction } from "express";
import { validationResult, type ValidationChain } from "express-validator";
import { sendValidationError } from "../utils/response.js";
import type { ValidationError } from "../types/api.types.js";

/**
 * Middleware to run validations and handle errors
 * @param validations - Array of validation chains
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors: ValidationError[] = errors.array().map((err) => {
        if (err.type === "field") {
          return {
            field: err.path,
            message: err.msg as string,
            value: err.value,
          };
        }
        return {
          field: "unknown",
          message: err.msg as string,
        };
      });

      sendValidationError(res, formattedErrors);
      return;
    }

    next();
  };
}

/**
 * Common validation error messages
 */
export const ValidationMessages = {
  required: (field: string) => `${field} is required`,
  minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) => `${field} must be at most ${max} characters`,
  email: "Invalid email format",
  url: "Invalid URL format",
  match: (field1: string, field2: string) => `${field1} must match ${field2}`,
  alphanumeric: (field: string) => `${field} can only contain letters, numbers, and underscores`,
  integer: (field: string) => `${field} must be a valid integer`,
  boolean: (field: string) => `${field} must be a boolean`,
  enum: (field: string, values: string[]) => `${field} must be one of: ${values.join(", ")}`,
};
