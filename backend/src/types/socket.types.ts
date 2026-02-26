// ===========================================
// Socket.io Types & Interfaces
// ===========================================
// Type definitions for real-time communication

import type { Server as SocketServer, Socket } from "socket.io";

/**
 * Socket.io server instance type
 */
export type IoServer = SocketServer;

/**
 * Socket.io client socket type
 */
export type IoSocket = Socket;

/**
 * Server to client events
 */
export interface ServerToClientEvents {
  // Scrape progress events
  "scrape:started": (data: ScrapeStartedEvent) => void;
  "scrape:progress": (data: ScrapeProgressEvent) => void;
  "scrape:completed": (data: ScrapeCompletedEvent) => void;
  "scrape:failed": (data: ScrapeFailedEvent) => void;

  // Queue events
  "queue:position": (data: QueuePositionEvent) => void;

  // Payment events
  "payment:success": (data: PaymentSuccessEvent) => void;

  // System events
  "system:notification": (data: SystemNotificationEvent) => void;
  "system:maintenance": (data: MaintenanceEvent) => void;
}

/**
 * Client to server events
 */
export interface ClientToServerEvents {
  // Subscribe to scrape updates
  "scrape:subscribe": (historyId: string) => void;
  "scrape:unsubscribe": (historyId: string) => void;

  // Cancel scrape
  "scrape:cancel": (historyId: string) => void;
}

/**
 * Inter-server events (for scaling with Redis adapter)
 */
export interface InterServerEvents {
  ping: () => void;
}

/**
 * Socket data (attached to each socket)
 */
export interface SocketData {
  userId: string;
  username: string;
  isAdmin: boolean;
}

// ===========================================
// Event Payload Types
// ===========================================

export interface ScrapeStartedEvent {
  historyId: string;
  url: string;
  platform: string;
  message: string;
  timestamp: Date;
}

export interface ScrapeProgressEvent {
  historyId: string;
  phase: "initializing" | "loading" | "scrolling" | "extracting" | "saving" | "error";
  progress: number; // 0-100
  commentsFound: number;
  message: string;
  timestamp: Date;
}

export interface ScrapeCompletedEvent {
  historyId: string;
  totalComments: number;
  duration: number; // milliseconds
  message: string;
  timestamp: Date;
}

export interface ScrapeFailedEvent {
  historyId: string;
  error: string;
  code: string;
  retryable: boolean;
  timestamp: Date;
}

export interface QueuePositionEvent {
  historyId: string;
  position: number;
  estimatedWait: number; // seconds
}

export interface SystemNotificationEvent {
  type: "info" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Date;
}

export interface MaintenanceEvent {
  scheduled: boolean;
  startTime: Date;
  duration: number; // minutes
  message: string;
}

export interface PaymentSuccessEvent {
  orderCode: number;
  planType: string;
  planExpiresAt: string; // ISO string
}
