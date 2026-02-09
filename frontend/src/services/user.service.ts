import api from "./api";
import { User } from "@/types";

export const userService = {
  // Lấy thông tin user profile
  getProfile: async () => {
    return api.get<{ user: User }>("/users/profile");
  },

  // Cập nhật thông tin profile
  updateProfile: async (data: Partial<User>) => {
    return api.patch<{ user: User }>("/users/profile", data);
  },

  // Lấy toàn bộ settings
  getSettings: async () => {
    return api.get("/users/settings");
  },

  // --- COOKIES (SỬA LẠI PHẦN NÀY) ---

  /**
   * Upload Cookie
   * Backend yêu cầu: { platform: "tiktok"|"facebook", cookieData: string, filename: string }
   */
  uploadCookie: async (platform: "TIKTOK" | "FACEBOOK", cookieData: string, filename: string) => {
    return api.post<{ cookie: any }>("/users/cookies", {
      platform: platform.toLowerCase(), // Backend check "tiktok" hoặc "facebook" thường
      cookieData, // Truyền chuỗi JSON string, không parse
      filename,
    });
  },

  /**
   * Xóa Cookie
   * Dùng method DELETE thay vì update null
   */
  deleteCookie: async (platform: "TIKTOK" | "FACEBOOK") => {
    return api.delete(`/users/cookies/${platform.toLowerCase()}`);
  },

  /**
   * Bật/Tắt Cookie
   */
  toggleCookie: async (platform: "TIKTOK" | "FACEBOOK", enabled: boolean) => {
    return api.patch("/users/cookies/toggle", {
      platform: platform.toLowerCase(),
      enabled,
    });
  },

  // --- PROXY ---

  getProxies: async () => {
    return api.get("/users/proxies");
  },

  updateProxies: async (proxyList: string, proxyRotation: string) => {
    return api.put("/users/proxies", { proxyList, proxyRotation });
  },

  toggleProxy: async (enabled: boolean) => {
    return api.patch("/users/proxies/toggle", { enabled });
  },
};
