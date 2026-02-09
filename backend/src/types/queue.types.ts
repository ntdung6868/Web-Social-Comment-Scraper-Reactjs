// ===========================================
// Queue Types & Interfaces
// ===========================================
// Type definitions for job queue system

import type { Platform } from "./enums.js";

/**
 * Scrape job data for queue
 */
export interface ScrapeJobData {
  historyId: number;
  userId: number;
  url: string;
  platform: Platform;
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
  historyId: number;
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
  historyId: number;
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
  concurrency: number;
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
