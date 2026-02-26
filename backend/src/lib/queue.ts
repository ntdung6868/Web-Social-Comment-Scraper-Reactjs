// ===========================================
// Queue Service — BullMQ Dual-Lane
// ===========================================
// PREMIUM lane : concurrency 5  — PERSONAL + PREMIUM plans run in parallel
// FREE lane    : concurrency 1  — FREE plan is strictly sequential

import { Queue, Worker, type Job, type JobType } from "bullmq";
import Redis from "ioredis";
import type {
  ScrapeJobData,
  ScrapeJobResult,
  QueueStats,
  JobInfo,
  InMemoryJob,
} from "../types/queue.types.js";
import { emitScrapeProgress, emitScrapeFailed, emitQueuePosition } from "./socket.js";
import { env } from "../config/env.js";
import { getSettingNumber } from "../utils/settings.js";

// ===========================================
// Configuration
// ===========================================

/** Hard per-job timeout: 8 minutes. The browser is force-killed and the job fails. */
const JOB_TIMEOUT_MS = 8 * 60 * 1000; // 480 000 ms

const PREMIUM_QUEUE_NAME = "premium-scraper-queue";
const FREE_QUEUE_NAME = "free-scraper-queue";

// Prefix isolates dev and production queues when they share the same Redis instance.
// dev  → "bull:development:premium-scraper-queue"
// prod → "bull:premium-scraper-queue"
const QUEUE_PREFIX = env.isProduction ? "bull" : `bull:${env.nodeEnv}`;

// ===========================================
// Redis Connection Factory
// ===========================================
// BullMQ workers use blocking Redis commands (BLMOVE / BZPOPMIN).
// Each Queue and Worker MUST have its own dedicated connection.
// Sharing a connection causes "maxRetriesPerRequest must be null" errors.

function createRedisConnection(): Redis {
  return new Redis(env.redis.url, {
    maxRetriesPerRequest: null, // REQUIRED for BullMQ blocking operations
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 5) return null; // stop retrying after 5 attempts
      return Math.min(times * 500, 3000);
    },
  });
}

// ===========================================
// BullMQ Queues
// ===========================================

const premiumQueue = new Queue<ScrapeJobData, ScrapeJobResult>(PREMIUM_QUEUE_NAME, {
  connection: createRedisConnection(),
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1, // withRetry() in scraper.service handles retries at the app level
    removeOnComplete: { count: 500, age: 3_600 }, // Keep last 500, max 1 h
    removeOnFail: { count: 200, age: 86_400 }, // Keep last 200, max 24 h
  },
});

const freeQueue = new Queue<ScrapeJobData, ScrapeJobResult>(FREE_QUEUE_NAME, {
  connection: createRedisConnection(),
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100, age: 3_600 },
    removeOnFail: { count: 100, age: 86_400 },
  },
});

// ===========================================
// In-Memory Job Registry
// ===========================================
// Keeps getQueueStats() / getAllJobs() synchronous for backward-compat with the
// admin API (admin.service.ts calls these synchronously).
// Entries are cleaned up hourly to prevent unbounded memory growth.

interface RegistryEntry extends JobInfo {
  userId: string; // Needed by userHasActiveJob() and cancelJobByHistoryId()
}

const jobRegistry = new Map<string, RegistryEntry>(); // key = historyId = BullMQ job ID

// Track active BullMQ Job objects so updateJobProgress() can call job.updateProgress().
const activeJobRefs = new Map<string, Job<ScrapeJobData, ScrapeJobResult>>();

// Hourly registry sweep — remove completed/failed entries older than 1 h.
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [id, entry] of jobRegistry.entries()) {
    if (
      (entry.status === "completed" || entry.status === "failed") &&
      entry.finishedAt &&
      entry.finishedAt.getTime() < cutoff
    ) {
      jobRegistry.delete(id);
    }
  }
}, 60_000);

// ===========================================
// Processor Handler (set by registerProcessor)
// ===========================================

let processorHandler: ((job: InMemoryJob) => Promise<ScrapeJobResult>) | null = null;

// ===========================================
// Core Worker Processor
// ===========================================

async function runJob(
  bullJob: Job<ScrapeJobData, ScrapeJobResult>,
  lane: "PREMIUM" | "FREE",
): Promise<ScrapeJobResult> {
  if (!processorHandler) {
    throw new Error("[Queue] No processor registered — call registerProcessor() before jobs are added");
  }

  const { historyId, userId, planType } = bullJob.data;

  // ── Structured Lane Logs ────────────────────────────────────────────────
  if (lane === "PREMIUM") {
    console.log(
      `[LANE: PREMIUM] Starting parallel job for UserID: ${userId}` +
        ` | Plan: ${planType} | History: ${historyId}`,
    );
  } else {
    console.log(
      `[LANE: FREE] Waiting for sequence for UserID: ${userId}` + ` | History: ${historyId}`,
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  // Mark registry entry as active
  const entry = jobRegistry.get(historyId);
  if (entry) {
    entry.status = "active";
    entry.startedAt = new Date();
  }

  // Track for external progress updates
  activeJobRefs.set(historyId, bullJob);

  // Adapt BullMQ Job → InMemoryJob shape expected by scraper.service.ts
  const adapted: InMemoryJob = {
    id: bullJob.id!,
    data: bullJob.data,
    status: "active",
    progress: 0,
    createdAt: new Date(bullJob.timestamp),
    startedAt: new Date(),
    retryCount: bullJob.attemptsMade,
  };

  // ── Hard 8-Minute Timeout ───────────────────────────────────────────────
  // If the scraper hangs (network stall, infinite scroll loop, etc.) this timer
  // rejects the race, which causes scraper.service.ts to call scraper.cleanup()
  // via its own try/catch/finally → browser is force-closed, job marked failed.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () =>
        reject(
          new Error(
            `[Queue] Hard timeout (${JOB_TIMEOUT_MS / 60_000} min) exceeded` +
              ` for history ${historyId} — killing job`,
          ),
        ),
      JOB_TIMEOUT_MS,
    );
  });
  // ────────────────────────────────────────────────────────────────────────

  try {
    const result = await Promise.race([processorHandler(adapted), timeoutPromise]);

    // Update registry on finish
    if (entry) {
      entry.status = result.success ? "completed" : "failed";
      entry.finishedAt = new Date();
      entry.progress = 100;
      if (!result.success) entry.failedReason = result.error;
    }

    console.log(
      `[LANE: ${lane}] Job finished for UserID: ${userId}` +
        ` | History: ${historyId} | Success: ${result.success}`,
    );

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errMsg.includes("Hard timeout") || errMsg.includes("timeout");

    if (entry) {
      entry.status = "failed";
      entry.finishedAt = new Date();
      entry.failedReason = errMsg;
    }

    console.error(
      `[LANE: ${lane}] Job failed for UserID: ${userId}` +
        ` | History: ${historyId} | Error: ${errMsg}`,
    );

    emitScrapeFailed(userId, {
      historyId,
      error: errMsg,
      code: isTimeout ? "JOB_TIMEOUT" : "SCRAPE_FAILED",
      retryable: false,
      timestamp: new Date(),
    });

    // Re-throw so BullMQ marks the job as failed in Redis
    throw error;
  } finally {
    // Always clean up, even on timeout
    clearTimeout(timeoutHandle);
    activeJobRefs.delete(historyId);
  }
}

// ===========================================
// BullMQ Workers (created lazily on registerProcessor)
// ===========================================

let premiumWorker: Worker<ScrapeJobData, ScrapeJobResult> | null = null;
let freeWorker: Worker<ScrapeJobData, ScrapeJobResult> | null = null;

async function createWorkers(): Promise<void> {
  if (premiumWorker || freeWorker) return; // idempotent — only create once

  // FREE lane concurrency is read from GlobalSettings so admins can tune it
  // without a code change or redeployment. Default is 1 (strictly sequential).
  const freeConcurrency = await getSettingNumber("freeConcurrency");

  // PREMIUM LANE — concurrency controlled by WORKER_CONCURRENCY env var (default 7)
  premiumWorker = new Worker<ScrapeJobData, ScrapeJobResult>(
    PREMIUM_QUEUE_NAME,
    (job) => runJob(job, "PREMIUM"),
    {
      connection: createRedisConnection(),
      prefix: QUEUE_PREFIX,
      concurrency: env.queue.workerConcurrency,
    },
  );

  // FREE LANE — concurrency from DB setting "freeConcurrency" (default 1)
  freeWorker = new Worker<ScrapeJobData, ScrapeJobResult>(FREE_QUEUE_NAME, (job) => runJob(job, "FREE"), {
    connection: createRedisConnection(),
    prefix: QUEUE_PREFIX,
    concurrency: freeConcurrency,
  });

  // Worker event listeners for observability
  const workerPairs: Array<[Worker<ScrapeJobData, ScrapeJobResult>, string]> = [
    [premiumWorker, "PREMIUM"],
    [freeWorker, "FREE"],
  ];

  for (const [worker, lane] of workerPairs) {
    worker.on("completed", (job) => {
      console.log(`[LANE: ${lane}] BullMQ ✅ completed job ${job.id} for history ${job.data.historyId}`);
    });

    worker.on("failed", (job, err) => {
      if (!job) return;
      console.error(`[LANE: ${lane}] BullMQ ❌ failed job ${job.id}: ${err.message}`);
    });

    worker.on("error", (err) => {
      console.error(`[LANE: ${lane}] Worker error: ${err.message}`);
    });
  }

  console.log(
    `[Queue] 🚀 BullMQ dual-lane workers started — PREMIUM (concurrency=${env.queue.workerConcurrency}) | FREE (concurrency=${freeConcurrency})`,
  );
}

// ===========================================
// Exported Queue API  (backward-compatible)
// ===========================================

/**
 * Add a scrape job to the appropriate lane based on planType.
 * Returns the historyId, which doubles as the BullMQ job ID.
 */
export async function addScrapeJob(data: ScrapeJobData): Promise<string> {
  const { historyId, userId, planType } = data;
  const isPaid = planType === "PERSONAL" || planType === "PREMIUM";
  const queue = isPaid ? premiumQueue : freeQueue;

  // Use historyId as the BullMQ job ID for O(1) lookup via getJob()
  await queue.add("scrape", data, {
    jobId: historyId,
    priority: isPaid ? 1 : 10, // Lower number = higher priority within the same queue
  });

  console.log(
    `[Queue] Enqueued → ${isPaid ? "PREMIUM" : "FREE"} lane` +
      ` | User: ${userId} | History: ${historyId} | Plan: ${planType}`,
  );

  // Register in memory for sync API access
  jobRegistry.set(historyId, {
    id: historyId,
    historyId,
    status: "waiting",
    progress: 0,
    createdAt: new Date(),
    userId,
  });

  // Emit queue position for free users so the frontend can show "Position N"
  if (!isPaid) {
    const waitingCount = await freeQueue.getWaitingCount();
    emitQueuePosition(userId, {
      historyId,
      position: waitingCount,
      estimatedWait: waitingCount * 90, // ~90 s per sequential free job
    });
  }

  return historyId;
}

/**
 * Get job info by job ID (= historyId in this implementation).
 */
export function getJobInfo(jobId: string): JobInfo | null {
  const entry = jobRegistry.get(jobId);
  if (!entry) return null;

  return {
    id: entry.id,
    historyId: entry.historyId,
    status: entry.status,
    progress: entry.progress,
    createdAt: entry.createdAt,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    failedReason: entry.failedReason,
  };
}

/**
 * Get job info by history ID.
 */
export function getJobByHistoryId(historyId: string): JobInfo | null {
  return getJobInfo(historyId);
}

/**
 * Cancel a job by its ID (alias for cancelJobByHistoryId since IDs are equal).
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  return cancelJobByHistoryId(jobId);
}

/**
 * Cancel a job by history ID.
 * Only waiting / delayed jobs can be cancelled safely.
 * Active jobs are left to finish (the scraper's own try/finally handles cleanup).
 */
export async function cancelJobByHistoryId(historyId: string): Promise<boolean> {
  try {
    // Check premium queue first, then free queue
    let job = await premiumQueue.getJob(historyId);
    if (!job) job = await freeQueue.getJob(historyId);
    if (!job) return false;

    const state = await job.getState();

    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      await job.remove();

      const entry = jobRegistry.get(historyId);
      if (entry) {
        entry.status = "failed";
        entry.finishedAt = new Date();
        entry.failedReason = "Cancelled by user";

        emitScrapeFailed(entry.userId, {
          historyId,
          error: "Cancelled by user",
          code: "CANCELLED",
          retryable: false,
          timestamp: new Date(),
        });
      }

      return true;
    }

    // Active jobs cannot be safely interrupted mid-flight
    return false;
  } catch {
    return false;
  }
}

/**
 * Get aggregate queue statistics.
 * Reads from the in-memory registry so it remains synchronous.
 */
export function getQueueStats(): QueueStats {
  let waiting = 0,
    active = 0,
    completed = 0,
    failed = 0,
    delayed = 0;

  for (const entry of jobRegistry.values()) {
    switch (entry.status) {
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
 * Get all job infos.
 * Reads from the in-memory registry so it remains synchronous.
 */
export function getAllJobs(): JobInfo[] {
  return Array.from(jobRegistry.values()).map((e) => ({
    id: e.id,
    historyId: e.historyId,
    status: e.status,
    progress: e.progress,
    createdAt: e.createdAt,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    failedReason: e.failedReason,
  }));
}

/**
 * Register the scrape job processor and start both BullMQ workers.
 * Must be called once on startup (ScraperService constructor does this).
 * Async because createWorkers() reads freeConcurrency from the DB.
 */
export async function registerProcessor(handler: (job: InMemoryJob) => Promise<ScrapeJobResult>): Promise<void> {
  processorHandler = handler;
  await createWorkers();
  console.log("[Queue] Processor registered — dual-lane BullMQ workers are live");
}

/**
 * Check whether a user already has an active or waiting job.
 * Prevents a single user from flooding the queue.
 */
export function userHasActiveJob(userId: string): boolean {
  for (const entry of jobRegistry.values()) {
    if (entry.userId === userId && (entry.status === "active" || entry.status === "waiting")) {
      return true;
    }
  }
  return false;
}

/**
 * Update job progress from within the scraper and emit a socket event.
 */
export function updateJobProgress(historyId: string, progress: number, message?: string): void {
  const entry = jobRegistry.get(historyId);
  if (entry) entry.progress = progress;

  const bullJob = activeJobRefs.get(historyId);
  if (bullJob) {
    // Fire-and-forget — failure here must not crash the scraper
    bullJob.updateProgress(progress).catch(() => {});

    emitScrapeProgress(entry?.userId ?? "", {
      historyId,
      phase: "extracting",
      progress,
      commentsFound: 0,
      message: message ?? `Progress: ${progress}%`,
      timestamp: new Date(),
    });
  }
}

/**
 * Return current PREMIUM worker concurrency limit (from env, set at startup).
 */
export function getWorkerConcurrency(): number {
  return env.queue.workerConcurrency;
}

/**
 * Check whether a user has a job currently sitting in either BullMQ queue
 * (waiting, active, or delayed). Used as a cross-check after server restarts
 * when the in-memory registry is empty but Redis still holds the job.
 */
export async function userHasJobInQueues(userId: string): Promise<boolean> {
  const states: JobType[] = ["waiting", "active", "delayed", "prioritized"];
  const [premiumJobs, freeJobs] = await Promise.all([
    premiumQueue.getJobs(states),
    freeQueue.getJobs(states),
  ]);
  return [...premiumJobs, ...freeJobs].some((job) => job.data.userId === userId);
}

/**
 * Remove all waiting/active/delayed BullMQ jobs for a user and mark
 * their registry entries as failed. Used by the force-reset endpoint.
 * Returns the number of queue slots cleared.
 */
export async function cancelUserJobs(userId: string): Promise<number> {
  let count = 0;
  const states: JobType[] = ["waiting", "active", "delayed", "prioritized"];

  const [premiumJobs, freeJobs] = await Promise.all([
    premiumQueue.getJobs(states),
    freeQueue.getJobs(states),
  ]);

  for (const job of [...premiumJobs, ...freeJobs]) {
    if (job.data.userId === userId) {
      try {
        await job.remove();
        count++;
      } catch {
        // job may have already finished between getJobs() and remove()
      }
    }
  }

  // Also flush matching in-memory registry entries
  for (const entry of jobRegistry.values()) {
    if (entry.userId === userId && (entry.status === "active" || entry.status === "waiting")) {
      entry.status = "failed";
      entry.finishedAt = new Date();
      entry.failedReason = "Force reset by user";
      count++;
    }
  }

  console.log(`[Queue] Force-reset cleared ${count} job slot(s) for user ${userId}`);
  return count;
}
