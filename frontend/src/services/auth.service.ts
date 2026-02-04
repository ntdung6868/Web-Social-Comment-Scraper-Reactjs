import { apiRequest } from "./api";
import type { ApiResponse, User, AuthTokens, LoginCredentials, RegisterData } from "@/types";

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshResponse {
  accessToken: string;
}

// Auth API service
export const authService = {
  // Login
  login: (credentials: LoginCredentials) => apiRequest.post<ApiResponse<LoginResponse>>("/auth/login", credentials),

  // Register
  register: (data: RegisterData) => apiRequest.post<ApiResponse<LoginResponse>>("/auth/register", data),

  // Logout
  logout: () => apiRequest.post<ApiResponse<null>>("/auth/logout"),

  // Refresh token
  refresh: () => apiRequest.post<ApiResponse<RefreshResponse>>("/auth/refresh"),

  // Get current user
  me: () => apiRequest.get<ApiResponse<User>>("/auth/me"),

  // Forgot password
  forgotPassword: (email: string) => apiRequest.post<ApiResponse<null>>("/auth/forgot-password", { email }),

  // Reset password
  resetPassword: (token: string, password: string) =>
    apiRequest.post<ApiResponse<null>>("/auth/reset-password", {
      token,
      password,
    }),

  // Verify email
  verifyEmail: (token: string) => apiRequest.post<ApiResponse<null>>("/auth/verify-email", { token }),
};
