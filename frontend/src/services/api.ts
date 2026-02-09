import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// Helper: Lấy token trực tiếp từ localStorage để tránh import Store gây lỗi vòng lặp
const getAccessTokenFromStorage = (): string | null => {
  try {
    const storage = localStorage.getItem("auth-storage"); // Key mặc định của persist trong auth.store
    if (!storage) return null;
    const parsed = JSON.parse(storage);
    return parsed.state?.accessToken || null;
  } catch {
    return null;
  }
};

// Helper: Cập nhật token mới vào localStorage để đồng bộ với Store
const setAccessTokenToStorage = (token: string) => {
  try {
    const storage = localStorage.getItem("auth-storage");
    if (storage) {
      const parsed = JSON.parse(storage);
      if (parsed.state) {
        parsed.state.accessToken = token;
        localStorage.setItem("auth-storage", JSON.stringify(parsed));
      }
    }
  } catch (e) {
    console.error("Error updating token to storage", e);
  }
};

// Tạo axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Quan trọng để gửi/nhận cookie
});

// Request Interceptor: Gắn token vào header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = getAccessTokenFromStorage();

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Variables quản lý việc refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Xử lý lỗi 401 và Refresh Token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Nếu lỗi 401 và chưa từng retry request này
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Nếu lỗi 401 xảy ra ngay tại endpoint refresh -> Token hết hạn hẳn -> Logout
      if (originalRequest.url?.includes("/auth/refresh")) {
        localStorage.removeItem("auth-storage");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      // Nếu đang có một tiến trình refresh chạy rồi, thì request này xếp hàng chờ
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi API refresh token
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || "/api/v1"}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        // Xử lý response linh hoạt (tùy cấu trúc backend trả về)
        const resData = response.data;
        // Thường backend trả về: { success: true, data: { accessToken: "..." } }
        const newAccessToken = resData.data?.accessToken || resData.accessToken;

        if (!newAccessToken) {
          throw new Error("Failed to retrieve new access token");
        }

        // Lưu token mới vào storage
        setAccessTokenToStorage(newAccessToken);

        // Xử lý các request đang chờ trong hàng đợi
        processQueue(null, newAccessToken);

        // Thử lại request gốc với token mới
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        // Nếu refresh thất bại -> Logout user
        processQueue(refreshError as Error, null);

        // Xóa storage và redirect về login
        localStorage.removeItem("auth-storage");
        window.location.href = "/login";

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;

// Export các method typed cho tiện sử dụng
export const apiRequest = {
  get: <T>(url: string, config?: Parameters<typeof api.get>[1]) => api.get<T>(url, config).then((res) => res.data),

  post: <T>(url: string, data?: unknown, config?: Parameters<typeof api.post>[2]) =>
    api.post<T>(url, data, config).then((res) => res.data),

  put: <T>(url: string, data?: unknown, config?: Parameters<typeof api.put>[2]) =>
    api.put<T>(url, data, config).then((res) => res.data),

  patch: <T>(url: string, data?: unknown, config?: Parameters<typeof api.patch>[2]) =>
    api.patch<T>(url, data, config).then((res) => res.data),

  delete: <T>(url: string, config?: Parameters<typeof api.delete>[1]) =>
    api.delete<T>(url, config).then((res) => res.data),
};
