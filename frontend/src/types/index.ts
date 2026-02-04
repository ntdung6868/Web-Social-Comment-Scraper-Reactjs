// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  subscriptionPlan: "FREE" | "PRO" | "ENTERPRISE";
  subscriptionStatus: "TRIAL" | "ACTIVE" | "CANCELLED" | "EXPIRED";
  isBanned: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    tokens: AuthTokens;
  };
}

// Scraper types
export interface ScrapeJob {
  id: string;
  userId: string;
  url: string;
  platform: "TIKTOK" | "FACEBOOK";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalComments: number;
  progress: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  scrapeId: string;
  username: string;
  content: string;
  timestamp: string | null;
  likes: number;
  replies: number;
  createdAt: string;
}

export interface ScrapeProgress {
  scrapeId: string;
  progress: number;
  totalComments: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  message?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

// System Health types
export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  database: "connected" | "disconnected";
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Dashboard Stats types
export interface DashboardStats {
  totalScrapes: number;
  completedToday: number;
  totalComments: number;
  successRate: number;
  averageTime: number;
}

// Notification types
export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}
