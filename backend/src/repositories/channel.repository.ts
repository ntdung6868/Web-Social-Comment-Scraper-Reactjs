// ===========================================
// Channel Repository
// ===========================================
// Data access layer for channel crawl operations

import { prisma } from "../config/database.js";
import type { ChannelCrawlJob, ChannelVideo, VideoScriptResult } from "@prisma/client";

// ===========================================
// Types
// ===========================================

export interface ChannelVideoData {
  tiktokId: string;
  videoUrl: string;
  description?: string;
  thumbnailUrl?: string;
  views: number;
  likes: number;
  commentCount: number;
  shares: number;
  postDate?: Date;
  meetsFilter: boolean;
}

export interface CreateCrawlJobData {
  userId: string;
  channelUrl: string;
  channelUsername: string;
  minViews: number;
  maxVideos: number;
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

// ===========================================
// Channel Repository Class
// ===========================================

export class ChannelRepository {
  // ===========================================
  // Crawl Job Operations
  // ===========================================

  async createCrawlJob(data: CreateCrawlJobData): Promise<ChannelCrawlJob> {
    return prisma.channelCrawlJob.create({
      data: {
        userId: data.userId,
        channelUrl: data.channelUrl,
        channelUsername: data.channelUsername,
        minViews: data.minViews,
        maxVideos: data.maxVideos,
        status: "PENDING",
      },
    });
  }

  async getCrawlJob(id: string): Promise<ChannelCrawlJob | null> {
    return prisma.channelCrawlJob.findUnique({ where: { id } });
  }

  async updateCrawlJobStatus(
    id: string,
    status: string,
    extras?: { totalVideos?: number; filteredVideos?: number; errorMessage?: string },
  ): Promise<ChannelCrawlJob> {
    return prisma.channelCrawlJob.update({
      where: { id },
      data: {
        status,
        ...(extras?.totalVideos !== undefined && { totalVideos: extras.totalVideos }),
        ...(extras?.filteredVideos !== undefined && { filteredVideos: extras.filteredVideos }),
        ...(extras?.errorMessage !== undefined && { errorMessage: extras.errorMessage }),
      },
    });
  }

  async getCrawlJobsByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ChannelCrawlJob>> {
    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
      prisma.channelCrawlJob.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.channelCrawlJob.count({ where: { userId } }),
    ]);
    const totalPages = Math.ceil(totalItems / limit);
    return {
      data: items,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async isJobOwner(jobId: string, userId: string): Promise<boolean> {
    const job = await prisma.channelCrawlJob.findFirst({
      where: { id: jobId, userId },
      select: { id: true },
    });
    return job !== null;
  }

  async deleteCrawlJob(id: string): Promise<void> {
    await prisma.channelCrawlJob.delete({ where: { id } });
  }

  // ===========================================
  // Video Operations
  // ===========================================

  async saveVideos(crawlJobId: string, videos: ChannelVideoData[]): Promise<number> {
    if (videos.length === 0) return 0;
    const result = await prisma.channelVideo.createMany({
      data: videos.map((v) => ({
        crawlJobId,
        tiktokId: v.tiktokId,
        videoUrl: v.videoUrl,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        views: v.views,
        likes: v.likes,
        commentCount: v.commentCount,
        shares: v.shares,
        postDate: v.postDate,
        meetsFilter: v.meetsFilter,
      })),
    });
    return result.count;
  }

  async getFilteredVideos(crawlJobId: string): Promise<ChannelVideo[]> {
    return prisma.channelVideo.findMany({
      where: { crawlJobId, meetsFilter: true },
      orderBy: { views: "desc" },
    });
  }

  async getAllVideos(crawlJobId: string): Promise<ChannelVideo[]> {
    return prisma.channelVideo.findMany({
      where: { crawlJobId },
      orderBy: { views: "desc" },
    });
  }

  async getVideoById(id: string): Promise<ChannelVideo | null> {
    return prisma.channelVideo.findUnique({ where: { id } });
  }

  async getVideosByIds(ids: string[]): Promise<ChannelVideo[]> {
    return prisma.channelVideo.findMany({ where: { id: { in: ids } } });
  }

  // ===========================================
  // Script Result Operations
  // ===========================================

  async saveScriptResult(data: {
    videoId: string;
    crawlJobId: string;
    scriptText: string;
    scriptLines: string[];
    sourceMethod: string;
    language?: string;
  }): Promise<VideoScriptResult> {
    return prisma.videoScriptResult.upsert({
      where: { videoId: data.videoId },
      create: {
        videoId: data.videoId,
        crawlJobId: data.crawlJobId,
        scriptText: data.scriptText,
        scriptLines: data.scriptLines,
        sourceMethod: data.sourceMethod,
        language: data.language,
      },
      update: {
        scriptText: data.scriptText,
        scriptLines: data.scriptLines,
        sourceMethod: data.sourceMethod,
        language: data.language,
      },
    });
  }

  async getScriptResults(crawlJobId: string): Promise<(VideoScriptResult & { video: ChannelVideo })[]> {
    return prisma.videoScriptResult.findMany({
      where: { crawlJobId },
      include: { video: true },
    });
  }

  async getScriptResultByVideoId(videoId: string): Promise<VideoScriptResult | null> {
    return prisma.videoScriptResult.findUnique({ where: { videoId } });
  }
}

export const channelRepository = new ChannelRepository();
