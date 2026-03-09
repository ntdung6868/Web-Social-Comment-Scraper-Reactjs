// ===========================================
// Channel Service — API calls
// ===========================================

import { apiRequest } from "./api";
import api from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/types";
import type {
  ChannelCrawlJob,
  ChannelVideo,
  VideoScriptResult,
  StartCrawlRequest,
  StartExtractRequest,
} from "@/types/channel.types";

export const channelService = {
  startCrawl: (data: StartCrawlRequest) =>
    apiRequest.post<ApiResponse<{ crawlJobId: string }>>("/channel/start", data),

  getStatus: (id: string) =>
    apiRequest.get<ApiResponse<ChannelCrawlJob>>(`/channel/${id}/status`),

  getVideos: (id: string) =>
    apiRequest.get<ApiResponse<ChannelVideo[]>>(`/channel/${id}/videos`),

  startExtract: (id: string, data: StartExtractRequest) =>
    apiRequest.post<ApiResponse<{ crawlJobId: string; videoCount: number }>>(`/channel/${id}/extract`, data),

  getScripts: (id: string) =>
    apiRequest.get<ApiResponse<VideoScriptResult[]>>(`/channel/${id}/scripts`),

  getHistory: (page = 1, limit = 10) =>
    apiRequest.get<ApiResponse<PaginatedResponse<ChannelCrawlJob>>>(`/channel/history?page=${page}&limit=${limit}`),

  deleteJob: (id: string) =>
    apiRequest.delete<void>(`/channel/${id}`),

  exportScripts: async (id: string, format: "xlsx" | "csv" | "json" = "xlsx") => {
    const response = await api.get(`/channel/${id}/export?format=${format}`, {
      responseType: format === "json" ? "json" : "blob",
    });
    return response.data;
  },
};
