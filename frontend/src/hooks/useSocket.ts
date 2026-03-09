import { useEffect, useRef, useState } from "react";
import { getSocket, connectSocket, subscribeToScrape, unsubscribeFromScrape } from "@/lib/socket";
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

interface UseSocketOptions {
  onStarted?: (data: ScrapeStartedEvent) => void;
  onProgress?: (data: ScrapeProgress) => void;
  onCompleted?: (data: ScrapeCompletedEvent) => void;
  onFailed?: (data: ScrapeFailedEvent) => void;
  onQueuePosition?: (data: QueuePositionEvent) => void;
  onPaymentSuccess?: (data: PaymentSuccessEvent) => void;
  // Channel events
  onChannelCrawlProgress?: (data: ChannelCrawlProgressEvent) => void;
  onChannelCrawlCompleted?: (data: ChannelCrawlCompletedEvent) => void;
  onChannelCrawlFailed?: (data: ChannelCrawlFailedEvent) => void;
  onChannelExtractProgress?: (data: ChannelExtractProgressEvent) => void;
  onChannelExtractCompleted?: (data: ChannelExtractCompletedEvent) => void;
  onChannelExtractFailed?: (data: ChannelExtractFailedEvent) => void;
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
 * Resilient to socket initialization race condition: DashboardLayout
 * initializes the socket in its own useEffect, which may run AFTER
 * child component effects. This hook polls for socket availability
 * and re-attaches listeners when the socket connects or reconnects.
 *
 * @param historyId - If provided, also subscribes to the specific scrape room
 * @param options - Callback handlers for each event type
 */
export function useSocket(historyId?: number | string, options?: UseSocketOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track socket connection readiness so effects re-run when socket appears
  const [socketReady, setSocketReady] = useState(() => !!getSocket()?.connected);

  // Poll for socket availability (handles race with DashboardLayout init)
  // and listen for connect/disconnect to keep state in sync
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const syncState = () => {
      const s = getSocket();
      const connected = !!s?.connected;
      setSocketReady((prev) => (prev !== connected ? connected : prev));
      // Once socket is available, stop polling and listen to events instead
      if (s && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    // Poll every 200ms until socket exists
    if (!getSocket()) {
      pollTimer = setInterval(syncState, 200);
    }

    // Once socket exists, listen for connect/disconnect
    const attachSocketListeners = () => {
      const s = getSocket();
      if (!s) return;
      s.on("connect", syncState);
      s.on("disconnect", syncState);
    };

    attachSocketListeners();
    // Also check periodically in case socket instance was replaced
    const recheckTimer = setInterval(() => {
      attachSocketListeners();
      syncState();
    }, 1000);

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      clearInterval(recheckTimer);
      const s = getSocket();
      if (s) {
        s.off("connect", syncState);
        s.off("disconnect", syncState);
      }
    };
  }, []);

  // Subscribe/unsubscribe to specific scrape room
  useEffect(() => {
    if (!socketReady) return;

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
  }, [historyId, socketReady]);

  // Attach event listeners — re-runs when socket becomes ready
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socketReady) return;

    const handleStarted = (data: ScrapeStartedEvent) => {
      if (isDuplicate(`started:${data.historyId}`)) return;
      if (!historyId || String(data.historyId) === String(historyId)) {
        optionsRef.current?.onStarted?.(data);
      }
    };

    const handleProgress = (data: ScrapeProgress) => {
      if (isDuplicate(`progress:${data.historyId}:${data.progress}`)) return;
      if (!historyId || String(data.historyId) === String(historyId)) {
        optionsRef.current?.onProgress?.(data);
      }
    };

    const handleCompleted = (data: ScrapeCompletedEvent) => {
      if (isDuplicate(`completed:${data.historyId}`)) return;
      if (!historyId || String(data.historyId) === String(historyId)) {
        optionsRef.current?.onCompleted?.(data);
      }
    };

    const handleFailed = (data: ScrapeFailedEvent) => {
      if (isDuplicate(`failed:${data.historyId}`)) return;
      if (!historyId || String(data.historyId) === String(historyId)) {
        optionsRef.current?.onFailed?.(data);
      }
    };

    const handleQueuePosition = (data: QueuePositionEvent) => {
      if (isDuplicate(`queue:${data.historyId}:${data.position}`)) return;
      if (!historyId || String(data.historyId) === String(historyId)) {
        optionsRef.current?.onQueuePosition?.(data);
      }
    };

    const handlePaymentSuccess = (data: PaymentSuccessEvent) => {
      optionsRef.current?.onPaymentSuccess?.(data);
    };

    const handleChannelCrawlProgress = (data: ChannelCrawlProgressEvent) => {
      if (isDuplicate(`ch:crawl:progress:${data.crawlJobId}`)) return;
      optionsRef.current?.onChannelCrawlProgress?.(data);
    };
    const handleChannelCrawlCompleted = (data: ChannelCrawlCompletedEvent) => {
      if (isDuplicate(`ch:crawl:completed:${data.crawlJobId}`)) return;
      optionsRef.current?.onChannelCrawlCompleted?.(data);
    };
    const handleChannelCrawlFailed = (data: ChannelCrawlFailedEvent) => {
      if (isDuplicate(`ch:crawl:failed:${data.crawlJobId}`)) return;
      optionsRef.current?.onChannelCrawlFailed?.(data);
    };
    const handleChannelExtractProgress = (data: ChannelExtractProgressEvent) => {
      if (isDuplicate(`ch:extract:progress:${data.crawlJobId}:${data.processed}`)) return;
      optionsRef.current?.onChannelExtractProgress?.(data);
    };
    const handleChannelExtractCompleted = (data: ChannelExtractCompletedEvent) => {
      if (isDuplicate(`ch:extract:completed:${data.crawlJobId}`)) return;
      optionsRef.current?.onChannelExtractCompleted?.(data);
    };
    const handleChannelExtractFailed = (data: ChannelExtractFailedEvent) => {
      if (isDuplicate(`ch:extract:failed:${data.crawlJobId}`)) return;
      optionsRef.current?.onChannelExtractFailed?.(data);
    };

    socket.on("scrape:started", handleStarted);
    socket.on("scrape:progress", handleProgress);
    socket.on("scrape:completed", handleCompleted);
    socket.on("scrape:failed", handleFailed);
    socket.on("queue:position", handleQueuePosition);
    socket.on("payment:success", handlePaymentSuccess);
    socket.on("channel:crawl:progress", handleChannelCrawlProgress);
    socket.on("channel:crawl:completed", handleChannelCrawlCompleted);
    socket.on("channel:crawl:failed", handleChannelCrawlFailed);
    socket.on("channel:extract:progress", handleChannelExtractProgress);
    socket.on("channel:extract:completed", handleChannelExtractCompleted);
    socket.on("channel:extract:failed", handleChannelExtractFailed);

    return () => {
      socket.off("scrape:started", handleStarted);
      socket.off("scrape:progress", handleProgress);
      socket.off("scrape:completed", handleCompleted);
      socket.off("scrape:failed", handleFailed);
      socket.off("queue:position", handleQueuePosition);
      socket.off("payment:success", handlePaymentSuccess);
      socket.off("channel:crawl:progress", handleChannelCrawlProgress);
      socket.off("channel:crawl:completed", handleChannelCrawlCompleted);
      socket.off("channel:crawl:failed", handleChannelCrawlFailed);
      socket.off("channel:extract:progress", handleChannelExtractProgress);
      socket.off("channel:extract:completed", handleChannelExtractCompleted);
      socket.off("channel:extract:failed", handleChannelExtractFailed);
    };
  }, [historyId, socketReady]);
}

export default useSocket;
