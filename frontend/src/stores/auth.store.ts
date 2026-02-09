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
          // Backend yêu cầu field là "username", ta map email vào đó
          const response = await authService.login({
            username: email,
            password,
            rememberMe,
          } as any);

          // Xử lý dữ liệu trả về: hỗ trợ cả bọc trong .data hoặc không
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
          // Bỏ qua lỗi logout nếu server lỗi
        } finally {
          // Xóa sạch state và localStorage
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

        // Nếu không có token -> Coi như chưa đăng nhập -> End
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
          // Gọi API lấy thông tin user.
          // Nếu token hết hạn, api.ts sẽ tự động Refresh -> Retry request này.
          // Nên ở đây ta không cần logic refresh thủ công nữa.
          const response = await authService.me();

          const resData = response.data as any;
          const userData = resData.data?.user || resData.user || resData;

          set({
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch (error) {
          // Nếu API trả về lỗi (nghĩa là cả Refresh Token cũng thất bại)
          // Thì logout user
          console.error("Check auth failed:", error);
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
      // Chỉ persist accessToken, user info sẽ fetch lại khi reload để đảm bảo tươi mới
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
    },
  ),
);
