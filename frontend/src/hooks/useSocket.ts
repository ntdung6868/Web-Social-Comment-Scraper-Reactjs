import { useEffect, useRef } from "react";
import { getSocket, connectSocket, subscribeToScrape, unsubscribeFromScrape } from "@/lib/socket";
import type {
  ScrapeStartedEvent,
  ScrapeProgress,
  ScrapeCompletedEvent,
  ScrapeFailedEvent,
  QueuePositionEvent,
} from "@/types";

interface UseSocketOptions {
  onStarted?: (data: ScrapeStartedEvent) => void;
  onProgress?: (data: ScrapeProgress) => void;
  onCompleted?: (data: ScrapeCompletedEvent) => void;
  onFailed?: (data: ScrapeFailedEvent) => void;
  onQueuePosition?: (data: QueuePositionEvent) => void;
}

// ── Dedup cache ──────────────────────────────────
// Prevents duplicate handler invocations caused by React 18 StrictMode
// double-mounting effects or HMR in development.
const recentEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 500;

function isDuplicate(eventKey: string): boolean {
  const now = Date.now();
  const lastSeen = recentEvents.get(eventKey);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }
  recentEvents.set(eventKey, now);
  // Prune old entries periodically
  if (recentEvents.size > 200) {
    for (const [key, ts] of recentEvents) {
      if (now - ts > DEDUP_WINDOW_MS * 2) recentEvents.delete(key);
    }
  }
  return false;
}

/**
 * Hook to subscribe to scrape events via Socket.io.
 * Backend emits to the user's personal room (`user:{userId}`) and
 * optionally to `scrape:{historyId}` rooms.
 *
 * @param historyId - If provided, also subscribes to the specific scrape room
 * @param options - Callback handlers for each event type
 */
export function useSocket(historyId?: number | string, options?: UseSocketOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Subscribe/unsubscribe to specific scrape room
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected) {
      connectSocket();
    }

    if (historyId !== undefined) {
      subscribeToScrape(historyId);
    }

    return () => {
      if (historyId !== undefined) {
        unsubscribeFromScrape(historyId);
      }
    };
  }, [historyId]);

  // Attach event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleStarted = (data: ScrapeStartedEvent) => {
      if (isDuplicate(`started:${data.historyId}`)) return;
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onStarted?.(data);
      }
    };

    const handleProgress = (data: ScrapeProgress) => {
      if (isDuplicate(`progress:${data.historyId}:${data.progress}`)) return;
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onProgress?.(data);
      }
    };

    const handleCompleted = (data: ScrapeCompletedEvent) => {
      if (isDuplicate(`completed:${data.historyId}`)) return;
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onCompleted?.(data);
      }
    };

    const handleFailed = (data: ScrapeFailedEvent) => {
      if (isDuplicate(`failed:${data.historyId}`)) return;
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onFailed?.(data);
      }
    };

    const handleQueuePosition = (data: QueuePositionEvent) => {
      if (isDuplicate(`queue:${data.historyId}:${data.position}`)) return;
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onQueuePosition?.(data);
      }
    };

    socket.on("scrape:started", handleStarted);
    socket.on("scrape:progress", handleProgress);
    socket.on("scrape:completed", handleCompleted);
    socket.on("scrape:failed", handleFailed);
    socket.on("queue:position", handleQueuePosition);

    return () => {
      socket.off("scrape:started", handleStarted);
      socket.off("scrape:progress", handleProgress);
      socket.off("scrape:completed", handleCompleted);
      socket.off("scrape:failed", handleFailed);
      socket.off("queue:position", handleQueuePosition);
    };
  }, [historyId]);
}

export default useSocket;
