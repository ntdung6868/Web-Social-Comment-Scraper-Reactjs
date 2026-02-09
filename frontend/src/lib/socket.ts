import { io, Socket } from "socket.io-client";
import type {
  ScrapeStartedEvent,
  ScrapeProgress,
  ScrapeCompletedEvent,
  ScrapeFailedEvent,
  QueuePositionEvent,
} from "@/types";

// ===========================================
// Socket Types (matching backend ServerToClientEvents)
// ===========================================

interface ServerToClientEvents {
  "scrape:started": (data: ScrapeStartedEvent) => void;
  "scrape:progress": (data: ScrapeProgress) => void;
  "scrape:completed": (data: ScrapeCompletedEvent) => void;
  "scrape:failed": (data: ScrapeFailedEvent) => void;
  "queue:position": (data: QueuePositionEvent) => void;
  "system:notification": (data: { type: string; title: string; message: string; timestamp: string }) => void;
  "system:maintenance": (data: { enabled: boolean; message?: string }) => void;
}

interface ClientToServerEvents {
  "scrape:subscribe": (historyId: number) => void;
  "scrape:unsubscribe": (historyId: number) => void;
  "scrape:cancel": (historyId: number) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ===========================================
// Socket Instance
// ===========================================

const SOCKET_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket: AppSocket | null = null;

/**
 * Get the socket instance (may be null if not initialized)
 */
export function getSocket(): AppSocket | null {
  return socket;
}

/**
 * Initialize socket with auth token
 */
export function initializeSocket(token: string): AppSocket {
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: { token },
  }) as AppSocket;

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] Connection error:", err.message);
  });

  return socket;
}

/**
 * Connect the socket (must be initialized first)
 */
export function connectSocket(): void {
  if (socket && !socket.connected) {
    socket.connect();
  }
}

/**
 * Disconnect the socket
 */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}

/**
 * Reconnect with a new token
 */
export function reconnectSocket(token: string): void {
  disconnectSocket();
  initializeSocket(token);
  connectSocket();
}

/**
 * Subscribe to scrape updates for a specific history ID
 * Backend uses room-based events: socket joins `scrape:{historyId}` room
 */
export function subscribeToScrape(historyId: number | string): void {
  const id = typeof historyId === "string" ? parseInt(historyId, 10) : historyId;
  if (socket?.connected && !isNaN(id)) {
    socket.emit("scrape:subscribe", id);
  }
}

/**
 * Unsubscribe from scrape updates
 */
export function unsubscribeFromScrape(historyId: number | string): void {
  const id = typeof historyId === "string" ? parseInt(historyId, 10) : historyId;
  if (socket?.connected && !isNaN(id)) {
    socket.emit("scrape:unsubscribe", id);
  }
}

/**
 * Request to cancel a scrape job
 */
export function cancelScrape(historyId: number | string): void {
  const id = typeof historyId === "string" ? parseInt(historyId, 10) : historyId;
  if (socket?.connected && !isNaN(id)) {
    socket.emit("scrape:cancel", id);
  }
}
