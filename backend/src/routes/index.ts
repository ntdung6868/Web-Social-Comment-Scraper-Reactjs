// ===========================================
// Routes Index
// ===========================================
// Re-export all route modules

import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import scraperRoutes from "./scraper.routes.js";
import adminRoutes from "./admin.routes.js";
import paymentRoutes from "./payment.routes.js";

export { authRoutes, userRoutes, scraperRoutes, adminRoutes, paymentRoutes };
