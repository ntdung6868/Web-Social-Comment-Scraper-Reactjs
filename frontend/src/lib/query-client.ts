import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Định nghĩa Query Keys tập trung
export const queryKeys = {
  auth: {
    me: ["auth", "me"],
  },
  user: {
    profile: ["user", "profile"],
    settings: () => ["user", "settings"],
  },
  scraper: {
    dashboard: () => ["scraper", "dashboard"],
    progress: ["scraper", "progress"],
    history: (id: string | number) => ["scraper", "history", id],
    recent: ["scraper", "recent"],
  },
  history: {
    list: (params: any) => ["history", "list", params],
    detail: (id: string | number) => ["history", "detail", id],
    comments: (id: string | number) => ["history", "comments", id],
  },
  admin: {
    users: (params: any) => ["admin", "users", params],
    logs: (params: any) => ["admin", "logs", params],
    scrapes: (params: any) => ["admin", "scrapes", params],
    stats: ["admin", "stats"],
    health: () => ["admin", "health"],
    dashboard: () => ["admin", "dashboard"],
  },
  settings: {
    all: ["settings"],
  },
};
