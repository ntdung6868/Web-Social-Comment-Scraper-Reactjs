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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword?: string) => Promise<void>;
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
          // --- SỬA LỖI QUAN TRỌNG TẠI ĐÂY ---
          // Backend yêu cầu key là "username", map giá trị email vào đó
          const response = await authService.login({
            username: email,
            password,
            rememberMe,
          } as any);

          // Xử lý dữ liệu trả về linh hoạt (hỗ trợ bọc trong .data hoặc không)
          const resData = response.data as any;
          const data = resData.data || resData;

          set({
            user: data.user,
            accessToken: data.accessToken || data.tokens?.accessToken,
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

          // Xử lý dữ liệu trả về linh hoạt
          const resData = response.data as any;
          const data = resData.data || resData;

          set({
            user: data.user,
            accessToken: data.accessToken || data.tokens?.accessToken,
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
          const resData = response.data as any;
          // Backend trả về { success: true, data: { user: ... } }
          const userData = resData.data?.user || resData.user || resData;

          set({
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          // Token invalid, try refresh
          try {
            const refreshResponse = await authService.refresh();
            const refreshResData = refreshResponse.data as any;
            const newAccessToken = refreshResData.data?.accessToken || refreshResData.accessToken;

            set({ accessToken: newAccessToken });

            // Gọi lại me() với token mới
            const meResponse = await authService.me();
            const meResData = meResponse.data as any;
            const userData = meResData.data?.user || meResData.user || meResData;

            set({
              user: userData,
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
