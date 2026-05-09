// ===========================================
// Bull-Board (BullMQ Admin UI)
// ===========================================
// Mounts an admin-only realtime dashboard at /admin/queue showing job counts,
// throughput, retries, and per-job inspection across all 5 queues. Useful when
// debugging "why is this scrape stuck" or "is the worker pool saturated".
//
// Auth: HTTP Basic Auth using BULL_BOARD_USER / BULL_BOARD_PASS from env.
// Browser prompts for credentials once and remembers them for the session,
// so admin can open the URL in a tab without crafting Authorization headers.

import type { Request, Response, NextFunction } from "express";
import { createBullBoard } from "@bull-board/api";
// @bull-board/api ships the adapters as separate top-level modules (not nested under /dist)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — types live in package's bullMQAdapter.d.ts which TS resolves at runtime
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { premiumQueue, freeQueue } from "./queue.js";
import { channelPremiumQueue, channelFreeQueue, scriptQueue } from "./channel-queue.js";

/**
 * Constant-time string compare to avoid timing attacks on the credential
 * check. Negligible perf impact for tiny strings, but good hygiene for an
 * auth boundary.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * HTTP Basic Auth middleware. Returns 401 + WWW-Authenticate so the browser
 * pops the native credential dialog. Refuses to load if credentials env vars
 * aren't set — better than silently exposing the queue UI.
 */
export function bullBoardAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedUser = process.env.BULL_BOARD_USER;
  const expectedPass = process.env.BULL_BOARD_PASS;

  if (!expectedUser || !expectedPass) {
    res.status(503).json({
      error: "Bull-board UI is disabled. Set BULL_BOARD_USER and BULL_BOARD_PASS in env.",
    });
    return;
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="CrawlComments Queue Admin"');
    res.status(401).send("Authentication required");
    return;
  }

  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const [user, ...passParts] = decoded.split(":");
    const pass = passParts.join(":"); // password may contain colons

    if (safeEqual(user ?? "", expectedUser) && safeEqual(pass, expectedPass)) {
      next();
      return;
    }
  } catch {
    /* fallthrough */
  }

  res.set("WWW-Authenticate", 'Basic realm="CrawlComments Queue Admin"');
  res.status(401).send("Invalid credentials");
}

/**
 * Build the bull-board Express router. The router exposes a UI tree under
 * whatever path the caller mounts it at — e.g. mount at `/admin/queue` and
 * the UI loads at `/admin/queue/`.
 */
export function buildBullBoardRouter() {
  const adapter = new ExpressAdapter();

  createBullBoard({
    queues: [
      // Scrape queues (one job = one TikTok/Facebook video scrape)
      new BullMQAdapter(premiumQueue, { description: "Scrape — paid plans (PREMIUM/PERSONAL)" }),
      new BullMQAdapter(freeQueue, { description: "Scrape — FREE plan (rate-limited)" }),
      // Channel-crawl queues (one job = enumerate a TikTok channel's videos)
      new BullMQAdapter(channelPremiumQueue, { description: "Channel crawl — paid" }),
      new BullMQAdapter(channelFreeQueue, { description: "Channel crawl — FREE" }),
      // Gemini-powered script extraction queue
      new BullMQAdapter(scriptQueue, { description: "AI script extraction (Gemini)" }),
    ],
    serverAdapter: adapter,
    options: {
      // Hide the bull-board promo banner and customize the title for the org
      uiConfig: {
        boardTitle: "CrawlComments — Queue Monitor",
        boardLogo: { path: "" },
        miscLinks: [],
        favIcon: { default: "/vite.svg", alternative: "/vite.svg" },
      },
    },
  });

  // The UI calls back into /<basePath>/api — must match what we pass to setBasePath.
  return adapter;
}
