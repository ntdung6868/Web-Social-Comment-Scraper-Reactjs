// ===========================================
// Queue Service
// ===========================================
// In-memory job queue with BullMQ fallback

import { EventEmitter } from "events";
import type {
  ScrapeJobData,
  ScrapeJobResult,
  QueueStats,
  JobInfo,
  InMemoryJob,
  QueueConfig,
} from "../types/queue.types.js";
import { emitScrapeProgress, emitScrapeFailed, emitQueuePosition } from "./socket.js";
import { getSettingNumber } from "../utils/settings.js";

// ===========================================
// Queue Configuration
// ===========================================

const DEFAULT_CONFIG: QueueConfig = {
  freeConcurrency: 1, // Free users wait in queue (sequential)
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds base delay
  jobTimeout: 300000, // 5 minutes
};

// ===========================================
// In-Memory Queue Implementation
// ===========================================

class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, InMemoryJob> = new Map();
  private paidWaitingQueue: string[] = []; // Paid plan jobs
  private freeWaitingQueue: string[] = []; // Free plan jobs
  private paidActiveJobs: Set<string> = new Set();
  private freeActiveJobs: Set<string> = new Set();
  private config: QueueConfig;
  private jobIdCounter = 0;
  private isProcessing = false;
  private processor: ((job: InMemoryJob) => Promise<ScrapeJobResult>) | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a job belongs to a paid plan
   */
  private isPaid(job: InMemoryJob): boolean {
    return job.data.planType === "PERSONAL" || job.data.planType === "PREMIUM";
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

    // Route to the correct queue based on plan type
    if (this.isPaid(job)) {
      this.paidWaitingQueue.push(jobId);
      console.log(`[Queue] Job ${jobId} added to PAID queue for history ${data.historyId} (${data.planType})`);
    } else {
      this.freeWaitingQueue.push(jobId);
      console.log(`[Queue] Job ${jobId} added to FREE queue for history ${data.historyId}`);
    }

    // Emit queue position (only meaningful for free users)
    this.updateQueuePositions();

    this.emit("added", job);

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
      // Remove from the correct waiting queue
      const queue = this.isPaid(job) ? this.paidWaitingQueue : this.freeWaitingQueue;
      const index = queue.indexOf(jobId);
      if (index > -1) {
        queue.splice(index, 1);
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
   * Check if a user has an active or waiting job
   */
  hasActiveJob(userId: number): boolean {
    for (const job of this.jobs.values()) {
      if (job.data.userId === userId && (job.status === "active" || job.status === "waiting")) {
        return true;
      }
    }
    return false;
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

    // Periodic zombie job detection (every 30s)
    setInterval(() => this.detectZombieJobs(), 30000);
  }

  /**
   * Detect and fail zombie jobs (active too long without completing)
   */
  private detectZombieJobs(): void {
    const now = Date.now();
    const zombieThreshold = this.config.jobTimeout + 30000; // jobTimeout + 30s grace

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === "active" && job.startedAt && now - job.startedAt.getTime() > zombieThreshold) {
        console.warn(
          `[Queue] Zombie job detected: ${jobId} (active for ${Math.round((now - job.startedAt.getTime()) / 1000)}s)`,
        );

        // Mark as failed
        job.status = "failed";
        job.finishedAt = new Date();
        job.failedReason = "Job timed out (zombie detection)";
        this.paidActiveJobs.delete(jobId);
        this.freeActiveJobs.delete(jobId);

        // Emit failure
        emitScrapeFailed(job.data.userId, {
          historyId: job.data.historyId,
          error: "Job timed out and was automatically cleaned up",
          code: "ZOMBIE_TIMEOUT",
          retryable: true,
          timestamp: new Date(),
        });

        // Process next
        this.tryProcess();
      }
    }
  }

  private async tryProcess(): Promise<void> {
    if (!this.processor) return;

    // Read dynamic settings (falls back to config defaults)
    const freeConcurrency = (await getSettingNumber("freeConcurrency")) ?? this.config.freeConcurrency;

    // Process paid jobs immediately — but max 1 active job per user
    const skippedPaidJobs: string[] = [];
    while (this.paidWaitingQueue.length > 0) {
      const jobId = this.paidWaitingQueue.shift();
      if (!jobId) break;
      const job = this.jobs.get(jobId);
      if (!job) continue;

      // Check if this user already has an active paid job
      const userHasActive = Array.from(this.paidActiveJobs).some((activeId) => {
        const activeJob = this.jobs.get(activeId);
        return activeJob && activeJob.data.userId === job.data.userId;
      });

      if (userHasActive) {
        // Re-queue — this user must wait for their current job to finish
        skippedPaidJobs.push(jobId);
      } else {
        this.processJob(jobId, job, this.paidActiveJobs);
      }
    }
    // Put skipped jobs back at the front
    this.paidWaitingQueue.unshift(...skippedPaidJobs);

    // Process free queue (low priority, sequential)
    while (this.freeActiveJobs.size < freeConcurrency && this.freeWaitingQueue.length > 0) {
      const jobId = this.freeWaitingQueue.shift();
      if (!jobId) break;
      const job = this.jobs.get(jobId);
      if (!job) continue;
      this.processJob(jobId, job, this.freeActiveJobs);
    }
  }

  /**
   * Process a single job within the given active set
   */
  private async processJob(jobId: string, job: InMemoryJob, activeSet: Set<string>): Promise<void> {
    if (!this.processor) return;

    activeSet.add(jobId);
    job.status = "active";
    job.startedAt = new Date();

    this.emit("active", job);
    const tier = this.isPaid(job) ? "PAID" : "FREE";
    console.log(`[Queue] Processing job ${jobId} [${tier}] for history ${job.data.historyId}`);

    try {
      // Set timeout (read dynamic setting — stored as seconds, convert to ms)
      const jobTimeoutSec = (await getSettingNumber("jobTimeout")) ?? this.config.jobTimeout / 1000;
      const jobTimeoutMs = jobTimeoutSec * 1000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Job timeout")), jobTimeoutMs);
      });

      // Process with timeout
      const result = await Promise.race([this.processor(job), timeoutPromise]);

      if (result.success) {
        job.status = "completed";
        job.finishedAt = new Date();
        job.progress = 100;
        this.emit("completed", job, result);
        console.log(`[Queue] Job ${jobId} completed with ${result.totalComments} comments`);
      } else {
        job.status = "failed";
        job.finishedAt = new Date();
        job.failedReason = result.error || "Scraping failed";
        this.emit("failed", job, new Error(job.failedReason));
        console.log(`[Queue] Job ${jobId} failed: ${job.failedReason}`);
      }
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
          // Re-add to correct queue
          if (this.isPaid(job)) {
            this.paidWaitingQueue.push(jobId);
          } else {
            this.freeWaitingQueue.push(jobId);
          }
          this.updateQueuePositions();
          this.tryProcess();
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
      activeSet.delete(jobId);

      // Update queue positions for remaining free jobs
      this.updateQueuePositions();

      // Process next jobs
      this.tryProcess();
    }
  }

  private updateQueuePositions(): void {
    // Only emit queue positions for free users (paid users start immediately)
    this.freeWaitingQueue.forEach((jobId, index) => {
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
 * Cancel job by history ID (used by socket cancel handler)
 */
export async function cancelJobByHistoryId(historyId: number): Promise<boolean> {
  const job = scrapeQueue.getJobByHistoryId(historyId);
  if (!job) return false;
  return scrapeQueue.cancel(job.id);
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
 * Check if a user already has an active/waiting job
 */
export function userHasActiveJob(userId: number): boolean {
  return scrapeQueue.hasActiveJob(userId);
}

/**
 * Update job progress
 */
export function updateJobProgress(jobId: string, progress: number, message?: string): void {
  scrapeQueue.updateProgress(jobId, progress, message);
}
