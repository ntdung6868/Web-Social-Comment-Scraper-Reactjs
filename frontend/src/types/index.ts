// ===========================================
// Enum-like Types (match backend enums.ts)
// ===========================================

export type Platform = "TIKTOK" | "FACEBOOK";
export type PlanType = "FREE" | "PRO";
export type PlanStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type ScrapeStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type ProxyRotation = "RANDOM" | "SEQUENTIAL";
export type CookieStatus = "UNKNOWN" | "VALID" | "INVALID" | "EXPIRED";

// ===========================================
// User Types (matches backend UserPublic)
// ===========================================

export interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  isAdmin: boolean;
  planType: PlanType;
  planStatus: PlanStatus;
  trialUses: number;
  maxTrialUses: number;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  isBanned: boolean;
  banReason: string | null;
}

// ===========================================
// Auth Types
// ===========================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  username: string; // can be username or email
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    expiresIn: number;
  };
}

// ===========================================
// User Settings Types
// ===========================================

export interface UserSettings {
  tiktokCookieFile: string | null;
  hasTiktokCookie: boolean;
  useTiktokCookie: boolean;
  tiktokCookieCount: number;
  facebookCookieFile: string | null;
  hasFacebookCookie: boolean;
  useFacebookCookie: boolean;
  facebookCookieCount: number;
  proxyEnabled: boolean;
  proxyCount: number;
  proxyRotation: ProxyRotation;
  headlessMode: boolean;
}

export interface CookieInfo {
  platform: "tiktok" | "facebook";
  hasCookie: boolean;
  filename: string | null;
  cookieCount: number;
  userAgent: string | null;
  lastValidated: string | null;
  status: CookieStatus;
  isEnabled: boolean;
}

export interface SubscriptionInfo {
  planType: PlanType;
  planStatus: PlanStatus;
  trialUses: number;
  maxTrialUses: number;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  canScrape: boolean;
  message: string;
  downloadLimit: number | null;
}

// ===========================================
// Scraper Types (matches backend)
// ===========================================

export interface ScrapeJob {
  id: number;
  userId: number;
  platform: Platform;
  url: string;
  totalComments: number;
  status: ScrapeStatus;
  errorMessage: string | null;
  createdAt: string;
  commentCount?: number;
}

export interface Comment {
  id: number;
  username: string;
  content: string;
  timestamp: string | null;
  likes: number;
  scrapedAt?: string;
}

// ===========================================
// Socket Event Types (matches backend socket.types.ts)
// ===========================================

export interface ScrapeStartedEvent {
  historyId: number;
  url: string;
  platform: string;
  message: string;
  timestamp: string;
}

export interface ScrapeProgress {
  historyId: number;
  phase: "initializing" | "loading" | "scrolling" | "extracting" | "saving";
  progress: number;
  commentsFound: number;
  message: string;
  timestamp: string;
}

export interface ScrapeCompletedEvent {
  historyId: number;
  totalComments: number;
  duration: number;
  message: string;
  timestamp: string;
}

export interface ScrapeFailedEvent {
  historyId: number;
  error: string;
  code: string;
  retryable: boolean;
  timestamp: string;
}

export interface QueuePositionEvent {
  historyId: number;
  position: number;
  estimatedWait: number;
}

// ===========================================
// Dashboard Stats Types
// ===========================================

export interface DashboardStats {
  stats: {
    totalScrapes: number;
    totalComments: number;
    successScrapes: number;
    failedScrapes: number;
  };
  recentScrapes: ScrapeJob[];
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ===========================================
// System Health Types
// ===========================================

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  services: {
    database: { status: "up" | "down" | "unknown"; latency?: number };
    redis: { status: "up" | "down" | "unknown" };
    scraper: { status: "up" | "down" | "unknown" };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    percentage: number;
    loadAverage: number[];
  };
}

// ===========================================
// Notification Types
// ===========================================

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// ===========================================
// Job Info Types
// ===========================================

export interface JobInfo {
  id: string;
  historyId: number;
  status: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";
  progress: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  failedReason?: string;
}
