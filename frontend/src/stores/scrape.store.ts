import { create } from "zustand";
import type { ScrapeJob, ScrapeProgress } from "@/types";

interface ScrapeState {
  // State
  activeScrapes: Map<number, ScrapeJob>;
  scrapeProgress: Map<number, ScrapeProgress>;
  isScrapingInProgress: boolean;

  // Actions
  addScrape: (scrape: ScrapeJob) => void;
  updateScrape: (id: number, updates: Partial<ScrapeJob>) => void;
  removeScrape: (id: number) => void;
  updateProgress: (progress: ScrapeProgress) => void;
  clearProgress: (id: number) => void;
  clearAllScrapes: () => void;
}

export const useScrapeStore = create<ScrapeState>((set) => ({
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

      const hasActive = Array.from(newActiveScrapes.values()).some(
        (s) => s.status === "PENDING" || s.status === "RUNNING",
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
        (s) => s.status === "PENDING" || s.status === "RUNNING",
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
      newScrapeProgress.set(progress.historyId, progress);

      // Also update the scrape job if tracked
      const scrape = state.activeScrapes.get(progress.historyId);
      if (scrape) {
        const newActiveScrapes = new Map(state.activeScrapes);
        newActiveScrapes.set(progress.historyId, {
          ...scrape,
          commentCount: progress.commentsFound,
          status: "RUNNING",
        });

        return {
          activeScrapes: newActiveScrapes,
          scrapeProgress: newScrapeProgress,
          isScrapingInProgress: true,
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
