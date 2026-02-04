import { apiRequest } from "./api";
import type { ApiResponse, User } from "@/types";

export interface UpdateProfileData {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
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
