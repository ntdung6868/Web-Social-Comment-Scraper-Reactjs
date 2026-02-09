import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";
import { authService } from "@/services/auth.service";

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      // Actions
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setAccessToken: (token) =>
        set({
          accessToken: token,
        }),

      login: async (username, password, rememberMe = false) => {
        set({ isLoading: true });
        try {
          // apiRequest unwraps axios .data, so response is ApiResponse<AuthDataResponse>
          const response = await authService.login({ username, password, rememberMe });

          set({
            user: response.data!.user,
            accessToken: response.data!.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (username, email, password, confirmPassword) => {
        set({ isLoading: true });
        try {
          const response = await authService.register({
            username,
            email,
            password,
            confirmPassword,
          });

          set({
            user: response.data!.user,
            accessToken: response.data!.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch {
          // Ignore logout errors if server is unreachable
        } finally {
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
          localStorage.removeItem("auth-storage");
        }
      },

      checkAuth: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          set({
            isInitialized: true,
            isAuthenticated: false,
            user: null,
          });
          return;
        }

        set({ isLoading: true });
        try {
          // If token expired, api.ts interceptor will auto-refresh then retry
          const response = await authService.me();

          set({
            user: response.data!.user,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          // Refresh also failed — force logout
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          });
          localStorage.removeItem("auth-storage");
        }
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist accessToken; user info is re-fetched on reload
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
    },
  ),
);
