import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";
import { authService } from '@/services/auth.service';

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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
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

      login: async (email, password, rememberMe = false) => {
        set({ isLoading: true });
        try {
          const response = await authService.login({
            email,
            password,
            rememberMe,
          });
          const { user, tokens } = response.data;

          set({
            user,
            accessToken: tokens.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const response = await authService.register({
            email,
            password,
            name,
          });
          const { user, tokens } = response.data;

          set({
            user,
            accessToken: tokens.accessToken,
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
          // Ignore logout errors
        } finally {
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
        }
      },

      checkAuth: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          set({ isInitialized: true });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authService.me();
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          // Token invalid, try refresh
          try {
            const refreshResponse = await authService.refresh();
            set({ accessToken: refreshResponse.data.accessToken });

            const meResponse = await authService.me();
            set({
              user: meResponse.data,
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
            });
          } catch {
            // Refresh failed, clear auth
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
            });
          }
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
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
    },
  ),
);
