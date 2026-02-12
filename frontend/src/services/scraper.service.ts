import { apiRequest } from "./api";
import api from "./api";
import type {
  ApiResponse,
  ScrapeJob,
  Comment,
  DashboardStats,
  PaginatedResponse,
  JobInfo,
  Platform,
  ScrapeStatus,
} from "@/types";

export interface StartScrapeData {
  url: string;
  maxComments?: number;
}

export interface StartScrapeResponse {
  historyId: number;
  jobId: string;
  queuePosition: number;
  isPaid: boolean;
}

export interface HistoryFilters {
  page?: number;
  limit?: number;
  status?: ScrapeStatus;
  platform?: Platform;
  sortBy?: "createdAt" | "totalComments";
  sortOrder?: "asc" | "desc";
}

export interface ScrapeStatusResponse {
  history: ScrapeJob;
  job: JobInfo | null;
}

export interface ScrapeHistoryDetail {
  id: number;
  userId: number;
  platform: Platform;
  url: string;
  totalComments: number;
  status: ScrapeStatus;
  errorMessage: string | null;
  createdAt: string;
  comments: Comment[];
}

export const scraperService = {
  startScrape: (data: StartScrapeData) => apiRequest.post<ApiResponse<StartScrapeResponse>>("/scraper/start", data),

  getJobStatus: (id: number | string) => apiRequest.get<ApiResponse<ScrapeStatusResponse>>(`/scraper/status/${id}`),

  getDashboard: () => apiRequest.get<ApiResponse<DashboardStats>>("/scraper/dashboard"),

  getHistory: (filters?: HistoryFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));
    if (filters?.status) params.append("status", filters.status);
    if (filters?.platform) params.append("platform", filters.platform);
    if (filters?.sortBy) params.append("sortBy", filters.sortBy);
    if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);

    return apiRequest.get<ApiResponse<PaginatedResponse<ScrapeJob>>>(`/scraper/history?${params.toString()}`);
  },

  getHistoryDetail: (id: number | string) => apiRequest.get<ApiResponse<ScrapeHistoryDetail>>(`/scraper/history/${id}`),

  deleteHistory: (id: number | string) => apiRequest.delete<void>(`/scraper/history/${id}`),

  exportComments: async (id: number | string, format: "xlsx" | "csv" | "json" = "xlsx") => {
    const response = await api.get(`/scraper/export/${id}?format=${format}`, {
      responseType: "blob",
    });
    return response.data;
  },
};
