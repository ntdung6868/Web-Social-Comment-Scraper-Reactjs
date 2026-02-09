// src/utils/scraper.utils.ts

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
 * Logic từ Python: _is_junk_line
 */
export function isJunkLine(text: string): boolean {
  const t = text.trim().toLowerCase();

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
  ];

  if (junkPhrases.includes(t)) return true;

  // Patterns thời gian (Regex từ Python converted to JS)
  const timePatterns = [/^\d+\s?(giờ|phút|giây|ngày|tuần|năm|h|m|d|y|w)$/, /^vừa xong$/, /^just now$/, /^\d+$/];

  return timePatterns.some((p) => p.test(t));
}

/**
 * Trích xuất User ID từ URL Facebook
 * Logic từ Python: _extract_fb_user_id
 */
export function extractFbUserId(url: string): string {
  if (!url) return "Unknown";

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const params = urlObj.searchParams;

    // Filter bad paths
    const badPaths = [
      "/posts/",
      "/videos/",
      "/watch/",
      "/story.php",
      "/photo",
      "/sharer.php",
      "/hashtag/",
      "/reel/",
      "/groups/",
    ];

    if (badPaths.some((p) => path.includes(p))) return "Unknown";

    // Case 1: profile.php?id=...
    if (path.includes("profile.php") && params.has("id")) {
      return params.get("id") || "Unknown";
    }

    // Case 2: /people/Name/ID
    if (path.includes("/people/")) {
      const parts = path.split("/").filter(Boolean);
      // Tìm phần tử số ở cuối
      for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d+$/.test(parts[i])) return parts[i];
      }
    }

    // Case 3: /username
    const parts = path.split("/").filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[0];
      const systemWords = ["watch", "groups", "gaming", "pages", "friends", "media"];
      if (!systemWords.includes(candidate.toLowerCase()) && candidate.length < 50) {
        return candidate;
      }
    }
  } catch (e) {
    console.error("Error extracting FB ID:", e);
  }
  return "Unknown";
}
