import { format, formatDistanceToNow, isValid, parseISO, Locale } from "date-fns";
import { vi as viLocale, enUS as enLocale } from "date-fns/locale";

/**
 * Get locale based on language code
 */
export function getDateLocale(language: string): Locale {
  return language === "vi" ? viLocale : enLocale;
}

/**
 * Format a date string to a human-readable format
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatStr = "MMM dd, yyyy",
  language = "en",
): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "-";
  return format(dateObj, formatStr, { locale: getDateLocale(language) });
}

/**
 * Format date with locale support (new function)
 */
export function formatDateByLang(date: string | Date | null | undefined, formatStr: string, language = "en"): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "-";
  return format(dateObj, formatStr, { locale: getDateLocale(language) });
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
 * Format date for Vietnamese locale (dd/MM/yyyy)
 */
export function formatDateVi(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "-";
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date for Vietnamese locale with time (dd/MM/yyyy HH:mm)
 */
export function formatDateTimeVi(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "-";
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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
