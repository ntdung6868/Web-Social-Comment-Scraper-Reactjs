// ===========================================
// Queue Service
// ===========================================
// In-memory job queue with BullMQ fallback

import { EventEmitter } from "events";
import type {
  ScrapeJobData,
  ScrapeJobResult,
  JobStatus,
  QueueStats,
  JobInfo,
  InMemoryJob,
  QueueConfig,
} from "../types/queue.types.js";
import {
  emitScrapeStarted,
  emitScrapeProgress,
  emitScrapeCompleted,
  emitScrapeFailed,
  emitQueuePosition,
} from "./socket.js";

// ===========================================
// Queue Configuration
// ===========================================

const DEFAULT_CONFIG: QueueConfig = {
  concurrency: 2, // Max concurrent scrape jobs
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds base delay
  jobTimeout: 300000, // 5 minutes
};

// ===========================================
// In-Memory Queue Implementation
// ===========================================

class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, InMemoryJob> = new Map();
  private waitingQueue: string[] = [];
  private activeJobs: Set<string> = new Set();
  private config: QueueConfig;
  private jobIdCounter = 0;
  private isProcessing = false;
  private processor: ((job: InMemoryJob) => Promise<ScrapeJobResult>) | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register job processor
   */
  process(handler: (job: InMemoryJob) => Promise<ScrapeJobResult>): void {
    this.processor = handler;
    this.startProcessing();
  }

  /**
   * Add job to queue
   */
  async add(data: ScrapeJobData): Promise<string> {
    const jobId = `job_${++this.jobIdCounter}_${Date.now()}`;

    const job: InMemoryJob = {
      id: jobId,
      data,
      status: "waiting",
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
    };

    this.jobs.set(jobId, job);
    this.waitingQueue.push(jobId);

    // Emit queue position
    this.updateQueuePositions();

    this.emit("added", job);
    console.log(`[Queue] Job ${jobId} added for history ${data.historyId}`);

    // Try to process
    this.tryProcess();

    return jobId;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): InMemoryJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get job by history ID
   */
  getJobByHistoryId(historyId: number): InMemoryJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.data.historyId === historyId) {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number, message?: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;

      // Emit progress via socket
      emitScrapeProgress(job.data.userId, {
        historyId: job.data.historyId,
        phase: "extracting",
        progress,
        commentsFound: 0,
        message: message || `Progress: ${progress}%`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === "waiting") {
      // Remove from waiting queue
      const index = this.waitingQueue.indexOf(jobId);
      if (index > -1) {
        this.waitingQueue.splice(index, 1);
      }
      job.status = "failed";
      job.failedReason = "Cancelled by user";
      job.finishedAt = new Date();

      emitScrapeFailed(job.data.userId, {
        historyId: job.data.historyId,
        error: "Cancelled by user",
        code: "CANCELLED",
        retryable: false,
        timestamp: new Date(),
      });

      return true;
    }

    // Cannot cancel active jobs easily without proper cancellation tokens
    return false;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let delayed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case "waiting":
          waiting++;
          break;
        case "active":
          active++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "delayed":
          delayed++;
          break;
      }
    }

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get all jobs info
   */
  getAllJobs(): JobInfo[] {
    return Array.from(this.jobs.values()).map((job) => ({
      id: job.id,
      historyId: job.data.historyId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      failedReason: job.failedReason,
    }));
  }

  /**
   * Clean completed/failed jobs older than duration
   */
  clean(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.finishedAt &&
        now - job.finishedAt.getTime() > maxAgeMs
      ) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private startProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Periodic check for jobs
    setInterval(() => this.tryProcess(), 1000);

    // Periodic cleanup
    setInterval(() => this.clean(), 60000);
  }

  private async tryProcess(): Promise<void> {
    if (!this.processor) return;
    if (this.activeJobs.size >= this.config.concurrency) return;
    if (this.waitingQueue.length === 0) return;

    const jobId = this.waitingQueue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job) return;

    // Start processing
    this.activeJobs.add(jobId);
    job.status = "active";
    job.startedAt = new Date();

    // Emit started event
    emitScrapeStarted(job.data.userId, {
      historyId: job.data.historyId,
      url: job.data.url,
      platform: job.data.platform,
      message: "Scraping started...",
      timestamp: new Date(),
    });

    this.emit("active", job);
    console.log(`[Queue] Processing job ${jobId} for history ${job.data.historyId}`);

    try {
      // Set timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Job timeout")), this.config.jobTimeout);
      });

      // Process with timeout
      const result = await Promise.race([this.processor(job), timeoutPromise]);

      // Success
      job.status = "completed";
      job.finishedAt = new Date();
      job.progress = 100;

      emitScrapeCompleted(job.data.userId, {
        historyId: job.data.historyId,
        totalComments: result.totalComments,
        duration: result.duration,
        message: `Successfully scraped ${result.totalComments} comments`,
        timestamp: new Date(),
      });

      this.emit("completed", job, result);
      console.log(`[Queue] Job ${jobId} completed with ${result.totalComments} comments`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Check if should retry
      if (job.retryCount < this.config.maxRetries) {
        job.retryCount++;
        job.status = "delayed";

        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, job.retryCount - 1);

        console.log(
          `[Queue] Job ${jobId} failed, retrying in ${delay}ms (attempt ${job.retryCount}/${this.config.maxRetries})`,
        );

        setTimeout(() => {
          job.status = "waiting";
          this.waitingQueue.push(jobId);
          this.updateQueuePositions();
        }, delay);
      } else {
        // Max retries exceeded
        job.status = "failed";
        job.finishedAt = new Date();
        job.failedReason = errorMessage;

        emitScrapeFailed(job.data.userId, {
          historyId: job.data.historyId,
          error: errorMessage,
          code: "MAX_RETRIES_EXCEEDED",
          retryable: false,
          timestamp: new Date(),
        });

        this.emit("failed", job, error);
        console.log(`[Queue] Job ${jobId} failed: ${errorMessage}`);
      }
    } finally {
      this.activeJobs.delete(jobId);

      // Update queue positions for remaining jobs
      this.updateQueuePositions();

      // Process next job
      this.tryProcess();
    }
  }

  private updateQueuePositions(): void {
    this.waitingQueue.forEach((jobId, index) => {
      const job = this.jobs.get(jobId);
      if (job) {
        emitQueuePosition(job.data.userId, {
          historyId: job.data.historyId,
          position: index + 1,
          estimatedWait: (index + 1) * 60, // Rough estimate: 60 seconds per job
        });
      }
    });
  }
}

// ===========================================
// Singleton Instance
// ===========================================

export const scrapeQueue = new InMemoryQueue();

// ===========================================
// Queue Service Functions
// ===========================================

/**
 * Add scrape job to queue
 */
export async function addScrapeJob(data: ScrapeJobData): Promise<string> {
  return scrapeQueue.add(data);
}

/**
 * Get job info by ID
 */
export function getJobInfo(jobId: string): JobInfo | null {
  const job = scrapeQueue.getJob(jobId);
  if (!job) return null;

  return {
    id: job.id,
    historyId: job.data.historyId,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    failedReason: job.failedReason,
  };
}

/**
 * Get job by history ID
 */
export function getJobByHistoryId(historyId: number): JobInfo | null {
  const job = scrapeQueue.getJobByHistoryId(historyId);
  if (!job) return null;

  return {
    id: job.id,
    historyId: job.data.historyId,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    failedReason: job.failedReason,
  };
}

/**
 * Cancel job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  return scrapeQueue.cancel(jobId);
}

/**
 * Get queue statistics
 */
export function getQueueStats(): QueueStats {
  return scrapeQueue.getStats();
}

/**
 * Get all jobs
 */
export function getAllJobs(): JobInfo[] {
  return scrapeQueue.getAllJobs();
}

/**
 * Register job processor
 */
export function registerProcessor(handler: (job: InMemoryJob) => Promise<ScrapeJobResult>): void {
  scrapeQueue.process(handler);
}

/**
 * Update job progress
 */
export function updateJobProgress(jobId: string, progress: number, message?: string): void {
  scrapeQueue.updateProgress(jobId, progress, message);
}
