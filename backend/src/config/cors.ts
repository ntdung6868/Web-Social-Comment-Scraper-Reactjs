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
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    // In development, allow any localhost port so Vite can use 5173–5200+
    // without needing to update .env every time ports shift.
    if (!env.isProduction && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }

    const allowedOrigins = parseOrigins(env.cors.origin);

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
