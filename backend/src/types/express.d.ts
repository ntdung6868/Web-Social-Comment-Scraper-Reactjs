// ===========================================
// Express Type Extensions
// ===========================================
// Extend Express types with custom properties

import type { RequestUser } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      requestId?: string;
    }
  }
}

export {};
