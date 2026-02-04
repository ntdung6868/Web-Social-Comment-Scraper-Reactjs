// ===========================================
// CORS Configuration
// ===========================================
// Cross-Origin Resource Sharing settings

import cors from "cors";
import { env } from "./env.js";

// Parse CORS origins (supports multiple origins separated by comma)
function parseOrigins(origin: string): string | string[] {
  if (origin.includes(",")) {
    return origin.split(",").map((o) => o.trim());
  }
  return origin;
}

// CORS options
export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = parseOrigins(env.cors.origin);

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is allowed
    if (Array.isArray(allowedOrigins)) {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      if (origin === allowedOrigins || allowedOrigins === "*") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: env.cors.credentials,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token"],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
  maxAge: 86400, // 24 hours
};

// Create CORS middleware
export const corsMiddleware = cors(corsOptions);
