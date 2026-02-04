import { create } from "zustand";
import type { ScrapeJob, ScrapeProgress } from "@/types";

interface ScrapeState {
  // State
  activeScrapes: Map<string, ScrapeJob>;
  scrapeProgress: Map<string, ScrapeProgress>;
  isScrapingInProgress: boolean;

  // Actions
  addScrape: (scrape: ScrapeJob) => void;
  updateScrape: (id: string, updates: Partial<ScrapeJob>) => void;
  removeScrape: (id: string) => void;
  updateProgress: (progress: ScrapeProgress) => void;
  clearProgress: (id: string) => void;
  clearAllScrapes: () => void;
}

export const useScrapeStore = create<ScrapeState>((set, get) => ({
  // Initial state
  activeScrapes: new Map(),
  scrapeProgress: new Map(),
  isScrapingInProgress: false,

  // Actions
  addScrape: (scrape) =>
    set((state) => {
      const newActiveScrapes = new Map(state.activeScrapes);
      newActiveScrapes.set(scrape.id, scrape);

      return {
        activeScrapes: newActiveScrapes,
        isScrapingInProgress: true,
      };
    }),

  updateScrape: (id, updates) =>
    set((state) => {
      const scrape = state.activeScrapes.get(id);
      if (!scrape) return state;

      const newActiveScrapes = new Map(state.activeScrapes);
      newActiveScrapes.set(id, { ...scrape, ...updates });

      // Check if all scrapes are completed
      const hasActive = Array.from(newActiveScrapes.values()).some(
        (s) => s.status === "PENDING" || s.status === "PROCESSING",
      );

      return {
        activeScrapes: newActiveScrapes,
        isScrapingInProgress: hasActive,
      };
    }),

  removeScrape: (id) =>
    set((state) => {
      const newActiveScrapes = new Map(state.activeScrapes);
      newActiveScrapes.delete(id);

      const newScrapeProgress = new Map(state.scrapeProgress);
      newScrapeProgress.delete(id);

      const hasActive = Array.from(newActiveScrapes.values()).some(
        (s) => s.status === "PENDING" || s.status === "PROCESSING",
      );

      return {
        activeScrapes: newActiveScrapes,
        scrapeProgress: newScrapeProgress,
        isScrapingInProgress: hasActive,
      };
    }),

  updateProgress: (progress) =>
    set((state) => {
      const newScrapeProgress = new Map(state.scrapeProgress);
      newScrapeProgress.set(progress.scrapeId, progress);

      // Also update the scrape status if present
      const scrape = state.activeScrapes.get(progress.scrapeId);
      if (scrape) {
        const newActiveScrapes = new Map(state.activeScrapes);
        newActiveScrapes.set(progress.scrapeId, {
          ...scrape,
          progress: progress.progress,
          totalComments: progress.totalComments,
          status: progress.status,
        });

        const hasActive = Array.from(newActiveScrapes.values()).some(
          (s) => s.status === "PENDING" || s.status === "PROCESSING",
        );

        return {
          activeScrapes: newActiveScrapes,
          scrapeProgress: newScrapeProgress,
          isScrapingInProgress: hasActive,
        };
      }

      return {
        scrapeProgress: newScrapeProgress,
      };
    }),

  clearProgress: (id) =>
    set((state) => {
      const newScrapeProgress = new Map(state.scrapeProgress);
      newScrapeProgress.delete(id);
      return { scrapeProgress: newScrapeProgress };
    }),

  clearAllScrapes: () =>
    set({
      activeScrapes: new Map(),
      scrapeProgress: new Map(),
      isScrapingInProgress: false,
    }),
}));
