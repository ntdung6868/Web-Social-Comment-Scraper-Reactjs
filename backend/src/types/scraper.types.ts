// ===========================================
// Scraper Types & Interfaces
// ===========================================
// Strict TypeScript definitions for Scraper-related data

import type { Platform, ScrapeStatus } from "@prisma/client";

/**
 * Scrape request payload
 */
export interface ScrapeRequestPayload {
  url: string;
}

/**
 * Scrape job status
 */
export interface ScrapeJob {
  id: number;
  userId: number;
  platform: Platform;
  url: string;
  totalComments: number;
  status: ScrapeStatus;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * Comment data structure
 */
export interface CommentData {
  id: number;
  username: string;
  content: string;
  timestamp: string | null;
  likes: number;
  scrapedAt: Date;
}

/**
 * Scrape history with comments
 */
export interface ScrapeHistoryDetail extends ScrapeJob {
  comments: CommentData[];
}

/**
 * Scrape history list item (without comments)
 */
export interface ScrapeHistoryItem extends ScrapeJob {
  commentCount: number;
}

/**
 * Scraping progress update
 */
export interface ScrapeProgress {
  historyId: number;
  total: number;
  status: "idle" | "running" | "completed" | "failed";
  message: string;
}

/**
 * URL validation result
 */
export interface UrlValidationResult {
  isValid: boolean;
  platform: Platform | null;
  error: string | null;
}

/**
 * Scraper microservice request
 */
export interface ScraperServiceRequest {
  url: string;
  platform: Platform;
  userId: number;
  historyId: number;
  cookies: string | null;
  proxy: string | null;
  headless: boolean;
}

/**
 * Scraper microservice response
 */
export interface ScraperServiceResponse {
  success: boolean;
  comments: ScrapedComment[];
  totalComments: number;
  error: string | null;
}

/**
 * Single scraped comment from microservice
 */
export interface ScrapedComment {
  username: string;
  content: string;
  timestamp: string | null;
  likes: number;
}

/**
 * Export format options
 */
export type ExportFormat = "xlsx" | "csv" | "json";

/**
 * Export request payload
 */
export interface ExportRequestPayload {
  historyId: number;
  format: ExportFormat;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalScrapes: number;
  totalComments: number;
  successScrapes: number;
  failedScrapes: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
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
