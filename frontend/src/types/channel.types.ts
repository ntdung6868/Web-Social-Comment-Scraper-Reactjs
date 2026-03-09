// ===========================================
// Channel Feature Types
// ===========================================

export type ChannelCrawlStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface ChannelCrawlJob {
  id: string;
  userId: string;
  channelUrl: string;
  channelUsername: string;
  minViews: number;
  maxVideos: number;
  status: ChannelCrawlStatus;
  totalVideos: number;
  filteredVideos: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ChannelVideo {
  id: string;
  crawlJobId: string;
  tiktokId: string;
  videoUrl: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  views: number;
  likes: number;
  commentCount: number;
  shares: number;
  postDate?: string | null;
  meetsFilter: boolean;
  scrapedAt: string;
}

export interface VideoScriptResult {
  id: string;
  videoId: string;
  crawlJobId: string;
  scriptText: string;
  scriptLines: string[];
  sourceMethod: "GEMINI_API" | "DESCRIPTION_FALLBACK";
  language?: string | null;
  extractedAt: string;
  video: ChannelVideo;
}

// ===========================================
// Request Types
// ===========================================

export interface StartCrawlRequest {
  channelUrl: string;
  minViews: number;
  maxVideos: number;
}

export interface StartExtractRequest {
  videoIds: string[];
}

// ===========================================
// Socket Event Types
// ===========================================

export interface ChannelCrawlProgressEvent {
  crawlJobId: string;
  videosFound: number;
  message: string;
  timestamp: Date | string;
}

export interface ChannelCrawlCompletedEvent {
  crawlJobId: string;
  totalVideos: number;
  filteredVideos: number;
  duration: number;
  message: string;
  timestamp: Date | string;
}

export interface ChannelCrawlFailedEvent {
  crawlJobId: string;
  error: string;
  timestamp: Date | string;
}

export interface ChannelExtractProgressEvent {
  crawlJobId: string;
  processed: number;
  total: number;
  currentVideoId: string;
  message: string;
  timestamp: Date | string;
}

export interface ChannelExtractCompletedEvent {
  crawlJobId: string;
  totalExtracted: number;
  duration: number;
  message: string;
  timestamp: Date | string;
}

export interface ChannelExtractFailedEvent {
  crawlJobId: string;
  error: string;
  timestamp: Date | string;
}
