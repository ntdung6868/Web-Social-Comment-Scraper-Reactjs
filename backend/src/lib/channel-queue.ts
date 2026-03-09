// ===========================================
// Channel Queue Service — BullMQ
// ===========================================
// Separate queue for channel crawl + script extraction jobs

import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";

// ===========================================
// Types
// ===========================================

export interface ChannelCrawlJobData {
  crawlJobId: string;
  userId: string;
  channelUrl: string;
  channelUsername: string;
  minViews: number;
  maxVideos: number;
  planType: "FREE" | "PERSONAL" | "PREMIUM";
  cookies: { data: string | null; userAgent: string | null };
  proxy: string | null;
  headless: boolean;
}

export interface ScriptExtractionJobData {
  crawlJobId: string;
  userId: string;
  videoIds: string[];
}

export interface ChannelJobResult {
  crawlJobId: string;
  success: boolean;
  error?: string;
}

// ===========================================
// Configuration
// ===========================================

const CHANNEL_PREMIUM_QUEUE = "premium-channel-queue";
const CHANNEL_FREE_QUEUE = "free-channel-queue";
const SCRIPT_QUEUE = "script-extraction-queue";
const QUEUE_PREFIX = env.isProduction ? "bull" : `bull:${env.nodeEnv}`;

function createRedisConnection(): Redis {
  return new Redis(env.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 500, 3000);
    },
  });
}

// ===========================================
// Queues
// ===========================================

const channelPremiumQueue = new Queue<ChannelCrawlJobData, ChannelJobResult>(CHANNEL_PREMIUM_QUEUE, {
  connection: createRedisConnection(),
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 200, age: 3_600 },
    removeOnFail: { count: 100, age: 86_400 },
  },
});

const channelFreeQueue = new Queue<ChannelCrawlJobData, ChannelJobResult>(CHANNEL_FREE_QUEUE, {
  connection: createRedisConnection(),
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100, age: 3_600 },
    removeOnFail: { count: 100, age: 86_400 },
  },
});

const scriptQueue = new Queue<ScriptExtractionJobData, ChannelJobResult>(SCRIPT_QUEUE, {
  connection: createRedisConnection(),
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 200, age: 3_600 },
    removeOnFail: { count: 100, age: 86_400 },
  },
});

// ===========================================
// In-Memory Registry
// ===========================================

interface ChannelRegistryEntry {
  crawlJobId: string;
  userId: string;
  status: "waiting" | "active" | "completed" | "failed";
  type: "crawl" | "script";
}

const channelJobRegistry = new Map<string, ChannelRegistryEntry>();

// ===========================================
// Processor Handlers
// ===========================================

let channelProcessorHandler: ((job: Job<ChannelCrawlJobData>) => Promise<ChannelJobResult>) | null = null;
let scriptProcessorHandler: ((job: Job<ScriptExtractionJobData>) => Promise<ChannelJobResult>) | null = null;

let workersCreated = false;

async function createChannelWorkers(): Promise<void> {
  if (workersCreated) return;
  workersCreated = true;

  const isProd = env.queue.workerConcurrency;

  // Channel crawl worker (PREMIUM lane)
  const premiumWorker = new Worker<ChannelCrawlJobData, ChannelJobResult>(
    CHANNEL_PREMIUM_QUEUE,
    async (job) => {
      if (!channelProcessorHandler) throw new Error("No channel processor registered");
      const entry = channelJobRegistry.get(job.data.crawlJobId);
      if (entry) entry.status = "active";
      try {
        const result = await channelProcessorHandler(job);
        if (entry) entry.status = result.success ? "completed" : "failed";
        return result;
      } catch (err) {
        if (entry) entry.status = "failed";
        throw err;
      }
    },
    { connection: createRedisConnection(), prefix: QUEUE_PREFIX, concurrency: isProd },
  );

  // Channel crawl worker (FREE lane)
  const freeWorker = new Worker<ChannelCrawlJobData, ChannelJobResult>(
    CHANNEL_FREE_QUEUE,
    async (job) => {
      if (!channelProcessorHandler) throw new Error("No channel processor registered");
      const entry = channelJobRegistry.get(job.data.crawlJobId);
      if (entry) entry.status = "active";
      try {
        const result = await channelProcessorHandler(job);
        if (entry) entry.status = result.success ? "completed" : "failed";
        return result;
      } catch (err) {
        if (entry) entry.status = "failed";
        throw err;
      }
    },
    { connection: createRedisConnection(), prefix: QUEUE_PREFIX, concurrency: 1 },
  );

  // Script extraction worker
  const scriptWorker = new Worker<ScriptExtractionJobData, ChannelJobResult>(
    SCRIPT_QUEUE,
    async (job) => {
      if (!scriptProcessorHandler) throw new Error("No script processor registered");
      const entry = channelJobRegistry.get(job.data.crawlJobId + ":script");
      if (entry) entry.status = "active";
      try {
        const result = await scriptProcessorHandler(job);
        if (entry) entry.status = result.success ? "completed" : "failed";
        return result;
      } catch (err) {
        if (entry) entry.status = "failed";
        throw err;
      }
    },
    { connection: createRedisConnection(), prefix: QUEUE_PREFIX, concurrency: 2 },
  );

  for (const [worker, name] of [[premiumWorker, "CHANNEL-PREMIUM"], [freeWorker, "CHANNEL-FREE"], [scriptWorker, "SCRIPT"]] as const) {
    worker.on("error", (err) => console.error(`[${name}] Worker error: ${err.message}`));
  }

  console.log("[ChannelQueue] 🚀 Channel + script workers started");
}

// ===========================================
// Exported API
// ===========================================

export async function addChannelCrawlJob(data: ChannelCrawlJobData): Promise<string> {
  const isPaid = data.planType === "PERSONAL" || data.planType === "PREMIUM";
  const queue = isPaid ? channelPremiumQueue : channelFreeQueue;

  await queue.add("channel-crawl", data, {
    jobId: data.crawlJobId,
    priority: isPaid ? 1 : 10,
  });

  channelJobRegistry.set(data.crawlJobId, {
    crawlJobId: data.crawlJobId,
    userId: data.userId,
    status: "waiting",
    type: "crawl",
  });

  console.log(`[ChannelQueue] Enqueued channel crawl → ${isPaid ? "PREMIUM" : "FREE"} | Job: ${data.crawlJobId}`);
  return data.crawlJobId;
}

export async function addScriptExtractionJob(data: ScriptExtractionJobData): Promise<string> {
  const jobId = `${data.crawlJobId}:script`;

  await scriptQueue.add("script-extraction", data, {
    jobId,
    priority: 5,
  });

  channelJobRegistry.set(jobId, {
    crawlJobId: data.crawlJobId,
    userId: data.userId,
    status: "waiting",
    type: "script",
  });

  console.log(`[ChannelQueue] Enqueued script extraction | Job: ${jobId}`);
  return jobId;
}

export function getChannelJobInfo(crawlJobId: string): ChannelRegistryEntry | null {
  return channelJobRegistry.get(crawlJobId) ?? null;
}

export function userHasActiveChannelJob(userId: string): boolean {
  for (const entry of channelJobRegistry.values()) {
    if (entry.userId === userId && (entry.status === "active" || entry.status === "waiting") && entry.type === "crawl") {
      return true;
    }
  }
  return false;
}

export async function cancelChannelJob(crawlJobId: string): Promise<boolean> {
  try {
    let job = await channelPremiumQueue.getJob(crawlJobId);
    if (!job) job = await channelFreeQueue.getJob(crawlJobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === "waiting" || state === "delayed" || state === "prioritized") {
      await job.remove();
      const entry = channelJobRegistry.get(crawlJobId);
      if (entry) entry.status = "failed";
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function registerChannelProcessor(
  channelHandler: (job: Job<ChannelCrawlJobData>) => Promise<ChannelJobResult>,
  scriptHandler: (job: Job<ScriptExtractionJobData>) => Promise<ChannelJobResult>,
): Promise<void> {
  channelProcessorHandler = channelHandler;
  scriptProcessorHandler = scriptHandler;
  await createChannelWorkers();
  console.log("[ChannelQueue] Processors registered — workers live");
}
