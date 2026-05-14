import { describe, it, expect } from "vitest";
import { TikTokScraper } from "../../src/lib/scraper/tiktok.scraper.js";

// Reach into the private isValidTikTokUrl by constructing a minimal scraper.
// We don't actually run it — only call the URL validator that's used at the
// top of scrape() to reject obvious garbage early.
function makeScraper(): TikTokScraper {
  return new TikTokScraper({
    userId: "test",
    historyId: "test",
    cookies: { data: null, userAgent: null },
    proxy: null,
    headless: true,
  });
}

describe("TikTok URL validation", () => {
  const valid = [
    "https://www.tiktok.com/@user/video/1234567890",
    "https://www.tiktok.com/@user.dot/video/1234",
    "https://tiktok.com/@user/photo/9876",
    "https://vm.tiktok.com/abcDEF/",
    "https://vt.tiktok.com/xyz123/",
    "https://www.tiktok.com/t/ZS-96CtRRfaKQe",
  ];

  const invalid = [
    "",
    "not a url",
    "https://example.com/video/123",
    "https://www.facebook.com/post/123",
    "https://tiktok.com",
    "https://www.tiktok.com/", // no @user
    "https://www.tiktok.com/@user", // no /video
    "https://www.tiktok.com/@user/video/abc", // non-numeric ID
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isValid = (s: TikTokScraper, url: string): boolean => (s as any).isValidTikTokUrl(url);

  for (const url of valid) {
    it(`accepts ${url}`, () => {
      expect(isValid(makeScraper(), url)).toBe(true);
    });
  }

  for (const url of invalid) {
    it(`rejects ${url || "(empty string)"}`, () => {
      expect(isValid(makeScraper(), url)).toBe(false);
    });
  }
});

describe("TikTokScraper.normalizeSameSite", () => {
  it("normalizes browser-extension exports", () => {
    expect(TikTokScraper.normalizeSameSite("strict")).toBe("Strict");
    expect(TikTokScraper.normalizeSameSite("Strict")).toBe("Strict");
    expect(TikTokScraper.normalizeSameSite("none")).toBe("None");
    expect(TikTokScraper.normalizeSameSite("no_restriction")).toBe("None");
    expect(TikTokScraper.normalizeSameSite("lax")).toBe("Lax");
    expect(TikTokScraper.normalizeSameSite("unspecified")).toBe("Lax");
  });

  it("falls back to Lax for unexpected input", () => {
    expect(TikTokScraper.normalizeSameSite(undefined)).toBe("Lax");
    expect(TikTokScraper.normalizeSameSite(null)).toBe("Lax");
    expect(TikTokScraper.normalizeSameSite(42)).toBe("Lax");
    expect(TikTokScraper.normalizeSameSite("")).toBe("Lax");
  });
});

describe("TikTokScraper.normalizeTikTokUrl", () => {
  it("strips tracking query params from canonical video/photo URLs", () => {
    expect(
      TikTokScraper.normalizeTikTokUrl(
        "https://www.tiktok.com/@keelin_.01/video/7588859111421349128?_r=1&_t=ZS-96CtRRfaKQe",
      ),
    ).toBe("https://www.tiktok.com/@keelin_.01/video/7588859111421349128");

    expect(TikTokScraper.normalizeTikTokUrl("https://www.tiktok.com/@user/photo/123?foo=bar#hash")).toBe(
      "https://www.tiktok.com/@user/photo/123",
    );
  });

  it("leaves short links unchanged", () => {
    expect(TikTokScraper.normalizeTikTokUrl("https://www.tiktok.com/t/ZS-96CtRRfaKQe")).toBe(
      "https://www.tiktok.com/t/ZS-96CtRRfaKQe",
    );
  });
});
