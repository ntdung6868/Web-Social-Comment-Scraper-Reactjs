import { io, Socket } from "socket.io-client";
import type {
  ScrapeStartedEvent,
  ScrapeProgress,
  ScrapeCompletedEvent,
  ScrapeFailedEvent,
  QueuePositionEvent,
  PaymentSuccessEvent,
} from "@/types";
import type {
  ChannelCrawlProgressEvent,
  ChannelCrawlCompletedEvent,
  ChannelCrawlFailedEvent,
  ChannelExtractProgressEvent,
  ChannelExtractCompletedEvent,
  ChannelExtractFailedEvent,
} from "@/types/channel.types";

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
  "payment:success": (data: PaymentSuccessEvent) => void;
  "channel:crawl:progress": (data: ChannelCrawlProgressEvent) => void;
  "channel:crawl:completed": (data: ChannelCrawlCompletedEvent) => void;
  "channel:crawl:failed": (data: ChannelCrawlFailedEvent) => void;
  "channel:extract:progress": (data: ChannelExtractProgressEvent) => void;
  "channel:extract:completed": (data: ChannelExtractCompletedEvent) => void;
  "channel:extract:failed": (data: ChannelExtractFailedEvent) => void;
}

interface ClientToServerEvents {
  "scrape:subscribe": (historyId: string) => void;
  "scrape:unsubscribe": (historyId: string) => void;
  "scrape:cancel": (historyId: string) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ===========================================
// Socket Instance
// ===========================================

// Socket.io connects to the server root — not the /api/v1 path.
// When VITE_WS_URL is not set, extract just the origin from VITE_API_URL
// so Socket.io doesn't treat the path as a namespace ("Invalid namespace" error).
function resolveSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl;
  }
}
const SOCKET_URL = resolveSocketUrl();

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
    transports: ["polling", "websocket"], // polling first for reverse-proxy compatibility
    path: "/socket.io/",
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
  if (socket?.connected && historyId) {
    socket.emit("scrape:subscribe", String(historyId));
  }
}

/**
 * Unsubscribe from scrape updates
 */
export function unsubscribeFromScrape(historyId: number | string): void {
  if (socket?.connected && historyId) {
    socket.emit("scrape:unsubscribe", String(historyId));
  }
}

/**
 * Request to cancel a scrape job
 */
export function cancelScrape(historyId: number | string): void {
  if (socket?.connected && historyId) {
    socket.emit("scrape:cancel", String(historyId));
  }
}
