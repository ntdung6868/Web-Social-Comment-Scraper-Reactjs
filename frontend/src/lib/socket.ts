import { io, Socket } from "socket.io-client";

// URL của backend socket (thường chung port với API nếu chạy local)
const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false, // Chỉ kết nối khi đã login
  withCredentials: true,
  transports: ["websocket"],
  path: "/socket.io/",
});

// Hàm khởi tạo (có thể dùng để gán token nếu cần thiết kế lại sau này)
export const initializeSocket = () => {
  if (!socket) return;

  socket.on("connect", () => {
    console.log("🟢 Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected");
  });

  socket.on("connect_error", (err) => {
    console.error("⚠️ Socket connection error:", err);
  });
};

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// Hàm tiện ích để lắng nghe sự kiện scrape
export const subscribeToScrape = (
  userId: number,
  callbacks: {
    onProgress?: (data: any) => void;
    onComplete?: (data: any) => void;
    onError?: (data: any) => void;
  },
) => {
  if (!socket) return () => {};

  // Tên sự kiện phải khớp với Backend phát ra
  const progressEvent = `scrape:progress:${userId}`;
  const completeEvent = `scrape:complete:${userId}`;
  const errorEvent = `scrape:failed:${userId}`;

  const handleProgress = (data: any) => {
    callbacks.onProgress?.(data);
  };

  const handleComplete = (data: any) => {
    callbacks.onComplete?.(data);
  };

  const handleError = (data: any) => {
    callbacks.onError?.(data);
  };

  socket.on(progressEvent, handleProgress);
  socket.on(completeEvent, handleComplete);
  socket.on(errorEvent, handleError);

  // Trả về hàm cleanup để remove listener khi component unmount
  return () => {
    socket.off(progressEvent, handleProgress);
    socket.off(completeEvent, handleComplete);
    socket.off(errorEvent, handleError);
  };
};
