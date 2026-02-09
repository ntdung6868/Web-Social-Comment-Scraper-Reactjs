// ===========================================
// Socket.io Service
// ===========================================
// Real-time communication with clients

import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "../utils/token.js";
import { env } from "../config/env.js";
import { cancelJobByHistoryId } from "../lib/queue.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  ScrapeStartedEvent,
  ScrapeProgressEvent,
  ScrapeCompletedEvent,
  ScrapeFailedEvent,
  QueuePositionEvent,
  SystemNotificationEvent,
} from "../types/socket.types.js";

// ===========================================
// Socket.io Server Instance
// ===========================================

let io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

// Track subscriptions: historyId -> Set of socket ids
const scrapeSubscriptions = new Map<number, Set<string>>();

// Track user sockets: userId -> Set of socket ids
const userSockets = new Map<number, Set<string>>();

// ===========================================
// Initialize Socket.io
// ===========================================

export function initializeSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: env.cors.origin.split(","),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        return next(new Error("Invalid token"));
      }

      // Attach user data to socket
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      socket.data.isAdmin = payload.isAdmin;

      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket] User ${userId} connected: ${socket.id}`);

    // Track user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Admin room
    if (socket.data.isAdmin) {
      socket.join("admin");
    }

    // ===========================================
    // Event Handlers
    // ===========================================

    // Subscribe to scrape updates
    socket.on("scrape:subscribe", (historyId) => {
      const room = `scrape:${historyId}`;
      socket.join(room);

      if (!scrapeSubscriptions.has(historyId)) {
        scrapeSubscriptions.set(historyId, new Set());
      }
      scrapeSubscriptions.get(historyId)!.add(socket.id);

      console.log(`[Socket] User ${userId} subscribed to scrape ${historyId}`);
    });

    // Unsubscribe from scrape updates
    socket.on("scrape:unsubscribe", (historyId) => {
      const room = `scrape:${historyId}`;
      socket.leave(room);

      scrapeSubscriptions.get(historyId)?.delete(socket.id);
      console.log(`[Socket] User ${userId} unsubscribed from scrape ${historyId}`);
    });

    // Cancel scrape request
    socket.on("scrape:cancel", async (historyId) => {
      console.log(`[Socket] User ${userId} requested cancel for scrape ${historyId}`);

      const cancelled = await cancelJobByHistoryId(historyId);

      if (cancelled) {
        // Notify the user
        socket.emit("system:notification", {
          type: "info",
          title: "Scrape Cancelled",
          message: `Scrape #${historyId} has been cancelled`,
          timestamp: new Date(),
        });
      } else {
        socket.emit("system:notification", {
          type: "warning",
          title: "Cannot Cancel",
          message: `Scrape #${historyId} is already running or completed and cannot be cancelled`,
          timestamp: new Date(),
        });
      }

      // Also notify admin
      io?.to("admin").emit("system:notification", {
        type: "info",
        title: "Scrape Cancelled",
        message: `User ${socket.data.username} cancelled scrape #${historyId}`,
        timestamp: new Date(),
      });
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      console.log(`[Socket] User ${userId} disconnected: ${socket.id}`);

      // Clean up user socket tracking
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
      }

      // Clean up subscriptions
      for (const [historyId, sockets] of scrapeSubscriptions.entries()) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          scrapeSubscriptions.delete(historyId);
        }
      }
    });
  });

  console.log("[Socket] Socket.io initialized");
  return io;
}

// ===========================================
// Emit Functions
// ===========================================

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketServer | null {
  return io;
}

/**
 * Emit scrape started event
 */
export function emitScrapeStarted(userId: number, event: ScrapeStartedEvent): void {
  if (!io) return;

  // Emit to user's room
  io.to(`user:${userId}`).emit("scrape:started", event);

  // Emit to scrape room
  io.to(`scrape:${event.historyId}`).emit("scrape:started", event);

  console.log(`[Socket] Emitted scrape:started for history ${event.historyId}`);
}

/**
 * Emit scrape progress event
 */
export function emitScrapeProgress(userId: number, event: ScrapeProgressEvent): void {
  if (!io) return;

  // Emit to user's room
  io.to(`user:${userId}`).emit("scrape:progress", event);

  // Emit to scrape room
  io.to(`scrape:${event.historyId}`).emit("scrape:progress", event);
}

/**
 * Emit scrape completed event
 */
export function emitScrapeCompleted(userId: number, event: ScrapeCompletedEvent): void {
  if (!io) return;

  io.to(`user:${userId}`).emit("scrape:completed", event);
  io.to(`scrape:${event.historyId}`).emit("scrape:completed", event);

  console.log(`[Socket] Emitted scrape:completed for history ${event.historyId}`);
}

/**
 * Emit scrape failed event
 */
export function emitScrapeFailed(userId: number, event: ScrapeFailedEvent): void {
  if (!io) return;

  io.to(`user:${userId}`).emit("scrape:failed", event);
  io.to(`scrape:${event.historyId}`).emit("scrape:failed", event);

  console.log(`[Socket] Emitted scrape:failed for history ${event.historyId}`);
}

/**
 * Emit queue position update
 */
export function emitQueuePosition(userId: number, event: QueuePositionEvent): void {
  if (!io) return;

  io.to(`user:${userId}`).emit("queue:position", event);
}

/**
 * Emit system notification to all admins
 */
export function emitAdminNotification(event: SystemNotificationEvent): void {
  if (!io) return;

  io.to("admin").emit("system:notification", event);
}

/**
 * Emit system notification to specific user
 */
export function emitUserNotification(userId: number, event: SystemNotificationEvent): void {
  if (!io) return;

  io.to(`user:${userId}`).emit("system:notification", event);
}

/**
 * Check if user is connected
 */
export function isUserConnected(userId: number): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

/**
 * Get connected user count
 */
export function getConnectedUserCount(): number {
  return userSockets.size;
}

/**
 * Get all connected socket count
 */
export function getConnectedSocketCount(): number {
  let count = 0;
  for (const sockets of userSockets.values()) {
    count += sockets.size;
  }
  return count;
}
