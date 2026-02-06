import { apiRequest } from "./api";
import type { ApiResponse, User } from "@/types";

export interface UpdateProfileData {
  name?: string;
  username?: string;
  currentPassword?: string;
  newPassword?: string;

  // Các trường Cookie (để update qua API profile)
  tiktokCookieData?: any[] | null;
  tiktokCookieStatus?: string;
  facebookCookieData?: any[] | null;
  facebookCookieStatus?: string;
}

export interface UserSettings {
  emailNotifications: boolean;
  language: string;
  timezone: string;
}

// User API service
export const userService = {
  // Get user profile
  getProfile: () => apiRequest.get<ApiResponse<User>>("/users/profile"),

  // Update profile
  updateProfile: (data: UpdateProfileData) => apiRequest.patch<ApiResponse<User>>("/users/profile", data),

  // --- MỚI: Hàm xử lý Upload/Xóa Cookie ---
  updateCookies: (platform: "TIKTOK" | "FACEBOOK", cookies: any[] | null) => {
    // Tự động map dữ liệu sang tên trường trong Database
    const payload: UpdateProfileData = {
      [platform === "TIKTOK" ? "tiktokCookieData" : "facebookCookieData"]: cookies,
      [platform === "TIKTOK" ? "tiktokCookieStatus" : "facebookCookieStatus"]: cookies ? "active" : "missing",
    };

    return apiRequest.patch<ApiResponse<User>>("/users/profile", payload);
  },
  // ----------------------------------------

  // Get user settings
  getSettings: () => apiRequest.get<ApiResponse<UserSettings>>("/users/settings"),

  // Update settings
  updateSettings: (settings: Partial<UserSettings>) =>
    apiRequest.patch<ApiResponse<UserSettings>>("/users/settings", settings),

  // Delete account
  deleteAccount: (password: string) =>
    apiRequest.delete<ApiResponse<null>>("/users/account", {
      data: { password },
    }),
};
