import { apiRequest } from "./api";
import type { ApiResponse, PaginatedResponse, ScrapeJob, Comment, DashboardStats } from "@/types";

export interface StartScrapeData {
  url: string;
  maxComments?: number;
}

export interface StartScrapeResponse {
  scrape: ScrapeJob;
  position: number;
}

export interface HistoryFilters {
  page?: number;
  limit?: number;
  status?: string;
  platform?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ScrapeDetailResponse {
  scrape: ScrapeJob;
  comments: Comment[];
}

// Scraper API service
export const scraperService = {
  // Start a new scrape job
  startScrape: (data: StartScrapeData) => apiRequest.post<ApiResponse<StartScrapeResponse>>("/scraper/start", data),

  // Get scrape job status
  getJobStatus: (id: string) => apiRequest.get<ApiResponse<ScrapeJob>>(`/scraper/status/${id}`),

  // Get dashboard stats
  getDashboard: () => apiRequest.get<ApiResponse<DashboardStats>>("/scraper/dashboard"),

  // Get scrape history with pagination
  getHistory: (filters?: HistoryFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));
    if (filters?.status) params.append("status", filters.status);
    if (filters?.platform) params.append("platform", filters.platform);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);

    return apiRequest.get<PaginatedResponse<ScrapeJob>>(`/scraper/history?${params.toString()}`);
  },

  // Get scrape detail with comments
  getHistoryDetail: (id: string, page = 1, limit = 50) =>
    apiRequest.get<
      ApiResponse<ScrapeDetailResponse> & {
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }
    >(`/scraper/history/${id}?page=${page}&limit=${limit}`),

  // Delete scrape history
  deleteHistory: (id: string) => apiRequest.delete<ApiResponse<null>>(`/scraper/history/${id}`),

  // Export comments
  exportComments: (id: string, format: "xlsx" | "csv" | "json" = "xlsx") =>
    apiRequest.get<Blob>(`/scraper/export/${id}?format=${format}`, {
      responseType: "blob",
    }),
};
