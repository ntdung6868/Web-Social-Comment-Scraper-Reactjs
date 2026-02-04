import { useEffect, useRef } from "react";
import { getSocket, connectSocket, subscribeToScrape, unsubscribeFromScrape } from '@/lib/socket';
import type { ScrapeProgress } from "@/types";

interface UseSocketOptions {
  onProgress?: (data: ScrapeProgress) => void;
  onCompleted?: (data: { scrapeId: string; totalComments: number; duration: number }) => void;
  onFailed?: (data: { scrapeId: string; error: string }) => void;
}

export function useSocket(scrapeId?: string, options?: UseSocketOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      connectSocket();
    }

    if (scrapeId) {
      subscribeToScrape(scrapeId);
    }

    return () => {
      if (scrapeId) {
        unsubscribeFromScrape(scrapeId);
      }
    };
  }, [scrapeId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleProgress = (data: ScrapeProgress) => {
      if (!scrapeId || data.scrapeId === scrapeId) {
        optionsRef.current?.onProgress?.(data);
      }
    };

    const handleCompleted = (data: { scrapeId: string; totalComments: number; duration: number }) => {
      if (!scrapeId || data.scrapeId === scrapeId) {
        optionsRef.current?.onCompleted?.(data);
      }
    };

    const handleFailed = (data: { scrapeId: string; error: string }) => {
      if (!scrapeId || data.scrapeId === scrapeId) {
        optionsRef.current?.onFailed?.(data);
      }
    };

    socket.on("scrape:progress", handleProgress);
    socket.on("scrape:completed", handleCompleted);
    socket.on("scrape:failed", handleFailed);

    return () => {
      socket.off("scrape:progress", handleProgress);
      socket.off("scrape:completed", handleCompleted);
      socket.off("scrape:failed", handleFailed);
    };
  }, [scrapeId]);
}

export default useSocket;
