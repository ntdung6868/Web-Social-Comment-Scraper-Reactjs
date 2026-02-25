// ===========================================
// Queue Types & Interfaces
// ===========================================
// Type definitions for job queue system

import type { Platform } from "./enums.js";

/**
 * Scrape job data for queue
 */
export interface ScrapeJobData {
  historyId: string;
  userId: string;
  url: string;
  platform: Platform;
  planType: "FREE" | "PERSONAL" | "PREMIUM";
  cookies: {
    data: string | null;
    userAgent: string | null;
  };
  proxy: string | null;
  headless: boolean;
  maxComments?: number;
  retryCount?: number;
}

/**
 * Scrape job result
 */
export interface ScrapeJobResult {
  historyId: string;
  success: boolean;
  totalComments: number;
  duration: number;
  error?: string;
}

/**
 * Queue job status
 */
export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";

/**
 * Queue statistics
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Job info for API response
 */
export interface JobInfo {
  id: string;
  historyId: string;
  status: JobStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  failedReason?: string;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  freeConcurrency: number; // Max concurrent free plan jobs
  maxGlobalConcurrency: number; // Hard cap on total simultaneous browser processes (paid + free)
  maxRetries: number;
  retryDelay: number; // milliseconds
  jobTimeout: number; // milliseconds
}

/**
 * In-memory job for fallback queue
 */
export interface InMemoryJob {
  id: string;
  data: ScrapeJobData;
  status: JobStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  failedReason?: string;
  retryCount: number;
}
