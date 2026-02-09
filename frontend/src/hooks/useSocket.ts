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
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onStarted?.(data);
      }
    };

    const handleProgress = (data: ScrapeProgress) => {
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onProgress?.(data);
      }
    };

    const handleCompleted = (data: ScrapeCompletedEvent) => {
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onCompleted?.(data);
      }
    };

    const handleFailed = (data: ScrapeFailedEvent) => {
      if (!historyId || data.historyId === Number(historyId)) {
        optionsRef.current?.onFailed?.(data);
      }
    };

    const handleQueuePosition = (data: QueuePositionEvent) => {
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
