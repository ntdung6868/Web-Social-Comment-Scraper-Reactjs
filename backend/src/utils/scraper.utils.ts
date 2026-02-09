// ===========================================
// Scraper Utility Functions
// ===========================================
// Ported from Python reference: utils for parsing, filtering, extracting

/**
 * Chuyển đổi số dạng text (1.2K, 5M) sang số nguyên
 * Logic từ Python: _parse_count
 */
export function parseCount(text: string): number {
  if (!text) return 0;

  const cleanText = text.toUpperCase().replace(/\s/g, "");

  try {
    if (cleanText.includes("K")) {
      return Math.floor(parseFloat(cleanText.replace("K", "")) * 1000);
    } else if (cleanText.includes("M")) {
      return Math.floor(parseFloat(cleanText.replace("M", "")) * 1000000);
    } else {
      // Loại bỏ ký tự không phải số
      const num = cleanText.replace(/[^\d]/g, "");
      return parseInt(num, 10) || 0;
    }
  } catch {
    return 0;
  }
}

/**
 * Kiểm tra dòng text có phải là rác không
 * Logic từ Python: _is_junk_line (đã mở rộng đầy đủ)
 */
export function isJunkLine(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;

  const junkPhrases = [
    "thích",
    "trả lời",
    "phản hồi",
    "chia sẻ",
    "xem thêm",
    "viết bình luận",
    "bình luận",
    "like",
    "reply",
    "share",
    "phù hợp nhất",
    "tất cả bình luận",
    "xem bản dịch",
    "theo dõi",
    "follow",
    "đang theo dõi",
    "đã chỉnh sửa",
    "tác giả",
    "top fan",
    "view more",
    "previous comments",
    // Thêm từ Python reference
    "xem thêm bình luận",
    "xem thêm phản hồi",
    "view more comments",
    "view more replies",
    "bình luận trước",
  ];

  if (junkPhrases.includes(t)) return true;

  // Patterns thời gian (comprehensive - từ Python reference)
  const timePatterns = [
    /^\d+\s?(giờ|phút|giây|ngày|tuần|năm|tháng|h|m|d|y|w|s)$/,
    /^vừa xong$/,
    /^just now$/,
    /^hôm qua$/,
    /^hôm nay$/,
    /^yesterday$/,
    /^\d+$/,
    // TikTok date formats
    /^\d{1,2}-\d{1,2}$/, // M-DD
    /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{1,3}[dhmswy]$/, // 2d, 5h, 10m
    /^\d+\s*(days?|hours?|minutes?|seconds?|weeks?|months?|years?)/,
    /^\d+\s*(d|h|m|s|w)\s+ago$/,
  ];

  return timePatterns.some((p) => p.test(t));
}

/**
 * Trích xuất User ID từ URL Facebook
 * Logic từ Python: _extract_fb_user_id (đầy đủ)
 */
export function extractFbUserId(url: string): string {
  if (!url) return "Unknown";

  try {
    // Handle relative URLs
    const fullUrl = url.startsWith("http") ? url : `https://www.facebook.com${url}`;
    const urlObj = new URL(fullUrl);
    const path = urlObj.pathname;
    const params = urlObj.searchParams;

    // Filter bad paths (check in path, not query)
    const badPaths = [
      "/posts/",
      "/videos/",
      "/watch/",
      "/story.php",
      "/photo",
      "/photo.php",
      "/sharer.php",
      "/hashtag/",
      "/reel/",
      "/share/",
      "/groups/",
    ];

    if (badPaths.some((p) => path.includes(p))) return "Unknown";

    // Case 1: profile.php?id=1000xxx
    if (path.includes("profile.php")) {
      if (params.has("id")) {
        return params.get("id") || "Unknown";
      }
    }

    // Case 2: /people/Name/1000xxx
    if (path.includes("/people/")) {
      const parts = path.split("/").filter(Boolean);
      // Tìm phần tử số ở cuối
      for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d+$/.test(parts[i]!)) return parts[i]!;
      }
      if (parts.length >= 2) return parts[parts.length - 1]!;
    }

    // Case 3: /username hoặc /username?comment_id=xxx
    const pathParts = path.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      const candidate = pathParts[0]!;

      // Loại bỏ các từ khóa hệ thống
      const systemWords = [
        "watch",
        "groups",
        "gaming",
        "pages",
        "friends",
        "events",
        "messages",
        "media",
        "dialog",
        "share",
        "reel",
        "story",
        "stories",
        "marketplace",
        "live",
        "fundraisers",
        "saved",
        "offers",
      ];

      if (candidate && !systemWords.includes(candidate.toLowerCase())) {
        // Validate: username FB thường có chữ cái, số, dấu chấm
        // Không phải chỉ toàn số (đó có thể là ID bài viết) trừ khi dài >10 ký tự
        if (!candidate.match(/^\d+$/) || candidate.length > 10) {
          return candidate;
        }
      }
    }
  } catch (e) {
    console.debug("Error extracting FB ID:", e);
  }
  return "Unknown";
}
