import { apiRequest } from "./api";
import type { ApiResponse, User, LoginCredentials, RegisterData } from "@/types";

export interface AuthDataResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export const authService = {
  login: (credentials: LoginCredentials) => apiRequest.post<ApiResponse<AuthDataResponse>>("/auth/login", credentials),

  register: (data: RegisterData) =>
    apiRequest.post<ApiResponse<AuthDataResponse>>("/auth/register", {
      username: data.username,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    }),

  logout: () => apiRequest.post<ApiResponse<null>>("/auth/logout"),

  refresh: () => apiRequest.post<ApiResponse<RefreshResponse>>("/auth/refresh"),

  me: () => apiRequest.get<ApiResponse<{ user: User }>>("/auth/me"),

  forgotPassword: (email: string) => apiRequest.post<ApiResponse<null>>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string, confirmPassword?: string) =>
    apiRequest.post<ApiResponse<null>>("/auth/reset-password", {
      token,
      password,
      confirmPassword: confirmPassword || password,
    }),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    apiRequest.post<ApiResponse<null>>("/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    }),

  getSessions: () =>
    apiRequest.get<
      ApiResponse<{
        sessions: Array<{
          id: number;
          deviceInfo: string | null;
          ipAddress: string | null;
          createdAt: string;
          expiresAt: string;
        }>;
      }>
    >("/auth/sessions"),

  logoutAll: () => apiRequest.post<ApiResponse<{ revokedSessions: number }>>("/auth/logout-all"),
};
