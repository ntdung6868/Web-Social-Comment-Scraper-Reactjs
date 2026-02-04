import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

/**
 * Format a date string to a human-readable format
 */
export function formatDate(date: string | Date | null | undefined, formatStr = "MMM dd, yyyy"): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "-";
  return format(dateObj, formatStr);
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "-";
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Format a number with comma separators
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  return num.toLocaleString();
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    if ("response" in error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      return axiosError.response?.data?.error || "An error occurred";
    }
    if ("message" in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return "An unexpected error occurred";
}

/**
 * Check if a URL is a valid TikTok or Facebook URL
 */
export function isValidPlatformUrl(url: string): { valid: boolean; platform?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("tiktok.com")) {
      return { valid: true, platform: "TIKTOK" };
    }
    if (parsed.hostname.includes("facebook.com") || parsed.hostname.includes("fb.com")) {
      return { valid: true, platform: "FACEBOOK" };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}
