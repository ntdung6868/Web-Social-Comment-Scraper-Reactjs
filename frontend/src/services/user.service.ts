import { apiRequest } from "./api";
import type { ApiResponse, User, UserSettings, CookieInfo, SubscriptionInfo, ProxyRotation } from "@/types";

export const userService = {
  // Profile
  getProfile: () => apiRequest.get<ApiResponse<{ user: User }>>("/users/profile"),

  updateProfile: (data: { username?: string; email?: string }) =>
    apiRequest.patch<ApiResponse<{ user: User }>>("/users/profile", data),

  // Settings
  getSettings: () => apiRequest.get<ApiResponse<{ settings: UserSettings }>>("/users/settings"),

  // Cookies
  getCookieInfo: (platform: "tiktok" | "facebook") =>
    apiRequest.get<ApiResponse<{ cookie: CookieInfo }>>(`/users/cookies/${platform}`),

  uploadCookie: (platform: "tiktok" | "facebook", cookieData: string, filename: string, userAgent?: string) =>
    apiRequest.post<ApiResponse<{ cookie: CookieInfo }>>("/users/cookies", {
      platform,
      cookieData,
      filename,
      userAgent,
    }),

  toggleCookie: (platform: "tiktok" | "facebook", enabled: boolean) =>
    apiRequest.patch<ApiResponse<{ cookie: CookieInfo }>>("/users/cookies/toggle", {
      platform,
      enabled,
    }),

  deleteCookie: (platform: "tiktok" | "facebook") => apiRequest.delete<ApiResponse<null>>(`/users/cookies/${platform}`),

  // Proxy
  getProxies: () =>
    apiRequest.get<ApiResponse<{ proxies: string[]; rotation: string; enabled: boolean }>>("/users/proxies"),

  updateProxies: (proxyList: string, proxyRotation: ProxyRotation) =>
    apiRequest.put<ApiResponse<{ proxyCount: number; proxyRotation: string; proxyEnabled: boolean }>>(
      "/users/proxies",
      {
        proxyList,
        proxyRotation,
      },
    ),

  toggleProxy: (enabled: boolean) =>
    apiRequest.patch<ApiResponse<{ proxyEnabled: boolean }>>("/users/proxies/toggle", { enabled }),

  deleteProxies: () => apiRequest.delete<ApiResponse<null>>("/users/proxies"),

  // Scraper settings
  updateScraperSettings: (headlessMode: boolean) =>
    apiRequest.patch<ApiResponse<{ headlessMode: boolean }>>("/users/settings/scraper", { headlessMode }),

  // Subscription
  getSubscription: () => apiRequest.get<ApiResponse<{ subscription: SubscriptionInfo }>>("/users/subscription"),
};
